import { Hono } from "hono";
import type { HonoEnv } from "../env.js";
import type { PairingSession } from "../db.js";
import { timingSafeEqual, childWebhookSecret, nowSecs } from "../util.js";
import { decryptToken } from "../crypto.js";
import { sendMessage, type TgUpdate } from "../tg.js";
import { generateDeviceToken, hashDeviceToken } from "@notified.sh/shared";
import { log } from "../log.js";

export const tgChildRoute = new Hono<HonoEnv>();

tgChildRoute.post("/v1/tg/child/:bot_id", async (c) => {
  const botId = Number(c.req.param("bot_id"));
  if (!Number.isFinite(botId) || botId <= 0) {
    return c.json({ error: { code: "bad_request", message: "Invalid bot_id." } }, 400);
  }

  // Verify per-bot derived webhook secret (constant-time).
  const incoming = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "";
  const expected = await childWebhookSecret(c.env.TG_WEBHOOK_SECRET, botId);
  if (!timingSafeEqual(incoming, expected)) {
    return c.json({ error: { code: "forbidden", message: "Bad secret." } }, 403);
  }

  const update = await c.req.json<TgUpdate>();

  if (!update.message?.text?.startsWith("/start")) {
    return c.json({ ok: true }); // Ignore non-/start messages silently.
  }

  const chatId = update.message.chat.id;

  // Find the awaiting_start session for this child bot.
  const session = await c.env.DB.prepare(
    "SELECT * FROM pairing_sessions WHERE child_bot_id = ? AND status = 'awaiting_start'",
  )
    .bind(botId)
    .first<PairingSession>();

  if (!session) {
    return c.json({ ok: true }); // No matching session — ignore.
  }

  if (!session.child_bot_token_enc) {
    log({ event: "child_start_missing_token", bot_id: botId });
    return c.json({ ok: true });
  }

  // Mint device_token, hash it, promote session → users row.
  const deviceToken = generateDeviceToken();
  const hash = await hashDeviceToken(deviceToken);
  const now = nowSecs();
  const encBuf = session.child_bot_token_enc as unknown as ArrayBuffer;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR REPLACE INTO users
       (device_token_hash, child_bot_id, child_bot_username, child_bot_token_enc, child_chat_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(hash, botId, session.child_bot_username, encBuf, chatId, now),
    c.env.DB.prepare(
      `UPDATE pairing_sessions
       SET status = 'complete', device_token_hash = ?, device_token_onetime = ?, child_chat_id = ?
       WHERE session_id = ?`,
    ).bind(hash, deviceToken, chatId, session.session_id),
  ]);

  // Send welcome message via the child bot (non-fatal if it fails).
  try {
    const childToken = await decryptToken(new Uint8Array(encBuf), c.env.AES_KEY_B64);
    await sendMessage(childToken, chatId, "✅ *Paired!* You'll receive Claude Code notifications here.");
  } catch (err) {
    log({ event: "welcome_message_failed", bot_id: botId, err_code: String(err) });
  }

  log({ event: "child_paired", session_id: session.session_id, bot_id: botId });
  return c.json({ ok: true });
});

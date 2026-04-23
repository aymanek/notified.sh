import { Hono } from "hono";
import type { HonoEnv } from "../env.js";
import type { PairingSession } from "../db.js";
import { timingSafeEqual, childWebhookSecret } from "../util.js";
import { encryptToken } from "../crypto.js";
import { getManagedBotToken, setWebhook, type TgUpdate } from "../tg.js";
import { log } from "../log.js";
import { DEFAULT_API_BASE } from "@notified.sh/shared";

export const tgManagerRoute = new Hono<HonoEnv>();

tgManagerRoute.post("/v1/tg/manager", async (c) => {
  // Constant-time webhook secret verification
  const incoming = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!timingSafeEqual(incoming, c.env.TG_WEBHOOK_SECRET)) {
    return c.json({ error: { code: "forbidden", message: "Bad secret." } }, 403);
  }

  const update = await c.req.json<TgUpdate>();

  if (update.managed_bot) {
    const { bot, token: rotatedToken } = update.managed_bot;

    if (rotatedToken) {
      // Token rotation: re-encrypt and update the users row.
      const enc = await encryptToken(rotatedToken, c.env.AES_KEY_B64);
      await c.env.DB.prepare(
        "UPDATE users SET child_bot_token_enc = ? WHERE child_bot_id = ?",
      )
        .bind(enc, bot.id)
        .run();
      log({ event: "token_rotated", bot_id: bot.id });
      return c.json({ ok: true });
    }

    // New child bot created — find the matching pending session by username.
    const session = await c.env.DB.prepare(
      "SELECT * FROM pairing_sessions WHERE suggested_username = ? AND status = 'pending'",
    )
      .bind(bot.username)
      .first<PairingSession>();

    if (!session) {
      log({ event: "managed_bot_no_session", bot_id: bot.id });
      return c.json({ ok: true }); // Not our session — ignore silently.
    }

    // Retrieve the real child bot token from Telegram.
    const childToken = await getManagedBotToken(c.env.MANAGER_BOT_TOKEN, bot.id);
    const enc = await encryptToken(childToken, c.env.AES_KEY_B64);

    // Register the child bot's webhook with a per-bot derived secret.
    const secret = await childWebhookSecret(c.env.TG_WEBHOOK_SECRET, bot.id);
    const webhookUrl = `${DEFAULT_API_BASE}/v1/tg/child/${bot.id}`;
    await setWebhook(childToken, webhookUrl, secret);

    // Advance session to awaiting_start.
    await c.env.DB.prepare(
      `UPDATE pairing_sessions
       SET status = 'awaiting_start', child_bot_id = ?, child_bot_username = ?, child_bot_token_enc = ?
       WHERE session_id = ?`,
    )
      .bind(bot.id, bot.username, enc, session.session_id)
      .run();

    log({ event: "child_bot_registered", session_id: session.session_id, bot_id: bot.id });
    return c.json({ ok: true });
  }

  // Unknown update kind — acknowledge silently so Telegram doesn't retry.
  return c.json({ ok: true });
});

import { Hono } from "hono";
import type { HonoEnv } from "../env.js";
import { requireAuth } from "../middleware.js";
import { decryptToken } from "../crypto.js";
import { deleteWebhook, TgError } from "../tg.js";
import type { User } from "../db.js";
import { log } from "../log.js";
import { hashPrefix } from "@notified.sh/shared";

export const unpairRoute = new Hono<HonoEnv>();

unpairRoute.post("/v1/unpair", requireAuth, async (c) => {
  const hash = c.get("deviceTokenHash");

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE device_token_hash = ?")
    .bind(hash)
    .first<User>();

  if (user) {
    // Best-effort: revoke child bot webhook before row deletion.
    try {
      const token = await decryptToken(new Uint8Array(user.child_bot_token_enc as unknown as ArrayBuffer), c.env.AES_KEY_B64);
      await deleteWebhook(token);
    } catch (err) {
      const code = err instanceof TgError ? err.code : String(err);
      log({ event: "delete_webhook_failed", user_prefix: hashPrefix(hash), err_code: code });
      // Non-fatal: local cleanup proceeds regardless.
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM users WHERE device_token_hash = ?").bind(hash),
    c.env.DB.prepare(
      "DELETE FROM notifications WHERE device_token_hash = ? AND status = 'pending'",
    ).bind(hash),
  ]);

  log({ event: "unpaired", user_prefix: hashPrefix(hash) });
  return c.json({ ok: true });
});

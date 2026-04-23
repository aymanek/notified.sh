import { Hono } from "hono";
import type { HonoEnv } from "../env.js";
import { requireAuth } from "../middleware.js";
import { log } from "../log.js";
import { hashPrefix } from "@notified.sh/shared";

export const unpairRoute = new Hono<HonoEnv>();

// POST /v1/unpair — delete user record and clean up
unpairRoute.post("/v1/unpair", requireAuth, async (c) => {
  const hash = c.get("deviceTokenHash");

  // TODO(M4): call Telegram deleteWebhook on child bot before row deletion.
  // Errors from Telegram should be logged but must not block local cleanup.

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM users WHERE device_token_hash = ?").bind(hash),
    c.env.DB.prepare(
      "DELETE FROM notifications WHERE device_token_hash = ? AND status = 'pending'",
    ).bind(hash),
  ]);

  log({ event: "unpaired", user_prefix: hashPrefix(hash) });

  return c.json({ ok: true });
});

import { Hono } from "hono";
import { TestRequestSchema, messageFor } from "@notified.sh/shared";
import type { HonoEnv } from "../env.js";
import { requireAuth } from "../middleware.js";
import type { User } from "../db.js";
import { decryptToken } from "../crypto.js";
import { sendMessage } from "../tg.js";
import { log } from "../log.js";
import { hashPrefix } from "@notified.sh/shared";

export const testRoute = new Hono<HonoEnv>();

testRoute.post("/v1/test", requireAuth, async (c) => {
  const hash = c.get("deviceTokenHash");

  const parsed = TestRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { limit_kind } = parsed.data;

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE device_token_hash = ?")
    .bind(hash)
    .first<User>();

  if (!user) {
    return c.json({ error: { code: "internal_error", message: "User record missing." } }, 500);
  }

  const token = await decryptToken(
    new Uint8Array(user.child_bot_token_enc as unknown as ArrayBuffer),
    c.env.AES_KEY_B64,
  );

  await sendMessage(token, user.child_chat_id, messageFor(limit_kind));

  log({ event: "test_sent", user_prefix: hashPrefix(hash), limit_kind });
  return c.json({ status: "sent" });
});

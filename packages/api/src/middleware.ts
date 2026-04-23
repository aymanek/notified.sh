import { createMiddleware } from "hono/factory";
import { hashDeviceToken, hashPrefix } from "@notified.sh/shared";
import type { HonoEnv } from "./env.js";
import type { User } from "./db.js";
import { log } from "./log.js";

const UNAUTHORIZED = {
  error: { code: "unauthorized", message: "Invalid or missing credentials." },
} as const;

/**
 * Validates `Authorization: Bearer <device_token>`, hashes the token, looks up
 * the users row. Sets `c.var.deviceTokenHash` on success; returns 401 otherwise.
 */
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json(UNAUTHORIZED, 401);
  }
  const token = header.slice(7).trim();
  if (!token) {
    return c.json(UNAUTHORIZED, 401);
  }

  const hash = await hashDeviceToken(token);
  const user = await c.env.DB.prepare("SELECT device_token_hash FROM users WHERE device_token_hash = ?")
    .bind(hash)
    .first<Pick<User, "device_token_hash">>();

  if (!user) {
    log({ event: "auth_failed", user_prefix: hashPrefix(hash) });
    return c.json(UNAUTHORIZED, 401);
  }

  c.set("deviceTokenHash", hash);
  await next();
});

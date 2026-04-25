import { Hono } from "hono";
import { NotifyRequestSchema, hashPrefix } from "@notified.sh/shared";
import type { HonoEnv } from "../env.js";
import { requireAuth } from "../middleware.js";
import { nanoid, nowSecs } from "../util.js";
import { log } from "../log.js";

export const notifyRoute = new Hono<HonoEnv>();

notifyRoute.post("/v1/notify", requireAuth, async (c) => {
  if (c.env.RL_NOTIFY) {
    const { success } = await c.env.RL_NOTIFY.limit({ key: c.get("deviceTokenHash") });
    if (!success) {
      return c.json({ error: { code: "rate_limited", message: "Too many requests." } }, 429);
    }
  }

  const hash = c.get("deviceTokenHash");

  const parsed = NotifyRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { limit_kind, reset_at_unix, idempotency_key } = parsed.data;

  // Composite UNIQUE (device_token_hash, idempotency_key) prevents double-scheduling.
  const id = nanoid(16);
  const now = nowSecs();

  try {
    await c.env.DB.prepare(
      `INSERT INTO notifications
       (id, device_token_hash, limit_kind, idempotency_key, reset_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(id, hash, limit_kind, idempotency_key, reset_at_unix, now)
      .run();
  } catch (err: unknown) {
    // D1 UNIQUE constraint violation → duplicate
    if (isUniqueViolation(err)) {
      log({ event: "notify_duplicate", user_prefix: hashPrefix(hash) });
      return c.json({ status: "duplicate" });
    }
    throw err;
  }

  log({ event: "notify_scheduled", user_prefix: hashPrefix(hash), limit_kind });
  return c.json({ status: "scheduled" }, 201);
});

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Error) return err.message.includes("UNIQUE constraint failed");
  return false;
}

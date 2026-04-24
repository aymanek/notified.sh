import { Hono } from "hono";
import type { HonoEnv } from "../env.js";
import { timingSafeEqual } from "../util.js";
import { DEFAULT_API_BASE } from "@notified.sh/shared";
import { log } from "../log.js";

export const adminRoute = new Hono<HonoEnv>();

/**
 * POST /admin/set-webhook
 * One-shot: registers the manager bot webhook using secrets already in the Worker.
 * Protected by TG_WEBHOOK_SECRET in the Authorization header.
 *
 * Usage:
 *   curl -X POST https://api.notified.sh/admin/set-webhook \
 *     -H "Authorization: Bearer <TG_WEBHOOK_SECRET>"
 */
adminRoute.post("/admin/set-webhook", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeEqual(token, c.env.TG_WEBHOOK_SECRET)) {
    return c.json({ error: { code: "forbidden", message: "Bad secret." } }, 403);
  }

  const webhookUrl = `${DEFAULT_API_BASE}/v1/tg/manager`;

  const res = await fetch(
    `https://api.telegram.org/bot${c.env.MANAGER_BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: c.env.TG_WEBHOOK_SECRET,
        drop_pending_updates: true,
      }),
    },
  );

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    log({ event: "set_webhook_failed", err_code: data.description ?? "unknown" });
    return c.json({ error: { code: "tg_error", message: data.description ?? "unknown" } }, 502);
  }

  log({ event: "set_webhook_ok", url: webhookUrl });
  return c.json({ ok: true, webhook_url: webhookUrl });
});

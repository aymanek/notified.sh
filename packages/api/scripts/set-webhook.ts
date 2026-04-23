/**
 * One-shot script: registers the manager bot webhook against api.notified.sh.
 * Run after `wrangler deploy` whenever the worker URL or secret changes.
 *
 * Usage:
 *   MANAGER_BOT_TOKEN=xxx TG_WEBHOOK_SECRET=yyy pnpm set-webhook
 */

const token = process.env["MANAGER_BOT_TOKEN"];
const secret = process.env["TG_WEBHOOK_SECRET"];
const apiBase = process.env["NOTIFIED_API_BASE"] ?? "https://api.notified.sh";

if (!token || !secret) {
  console.error("Error: MANAGER_BOT_TOKEN and TG_WEBHOOK_SECRET must be set.");
  process.exit(1);
}

const webhookUrl = `${apiBase}/v1/tg/manager`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret, drop_pending_updates: true }),
});

const data = (await res.json()) as { ok: boolean; description?: string };
if (!data.ok) {
  console.error(`setWebhook failed: ${data.description ?? "unknown error"}`);
  process.exit(1);
}

console.log(`✓ Manager webhook registered → ${webhookUrl}`);

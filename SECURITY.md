# Security Policy

## Reporting a vulnerability

Email **aymanekamal47@gmail.com** with details. Do not open a public issue.

Include:
- Affected component (CLI, API/Worker, plugin)
- Reproduction steps
- Impact assessment
- Suggested fix (optional)

## Response window

- Initial acknowledgement: within 72 hours
- Triage and severity assignment: within 7 days
- Fix or mitigation timeline: within 90 days for confirmed issues

Coordinated disclosure preferred. Public credit on request.

## Scope

In scope:
- `notified.sh` CLI (npm package)
- `api.notified.sh` Worker
- `notified` Claude Code plugin
- `@notified.sh/shared` contracts package

Out of scope:
- Telegram Bot API itself
- Cloudflare Workers platform
- User's own bot tokens (managed bot rotation is supported via `replaceManagedBotToken`)

## Threat model summary

- Manager bot token: Workers Secrets only, never in git, never in D1
- Child bot tokens: AES-256-GCM encrypted in D1
- Device tokens: stored hashed in D1, plaintext only in user's `~/.config/notified/config.json` (mode 0600)
- Webhook authenticity: constant-time check on `X-Telegram-Bot-Api-Secret-Token`; per-bot HMAC-derived secrets for child webhooks
- Replay protection: composite UNIQUE on `(device_token_hash, idempotency_key)` for `/v1/notify`

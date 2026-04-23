/** Scrub sensitive values from strings before printing in debug/error output. */

// Base64url token ~43 chars (device_token = 32 bytes)
const TOKEN_RE = /\b[A-Za-z0-9_-]{43}\b/g;
// Telegram bot token format: <digits>:<alphanum+>
const BOT_TOKEN_RE = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g;

export function redact(text: string): string {
  return text.replace(TOKEN_RE, "[REDACTED]").replace(BOT_TOKEN_RE, "[REDACTED]");
}

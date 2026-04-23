/**
 * Generate a URL-safe random string of exactly `n` characters using WebCrypto.
 * Characters drawn from base64url alphabet [A-Za-z0-9_-].
 */
export function nanoid(n: number): string {
  // Over-generate bytes so slicing to n never risks short output.
  const bytes = new Uint8Array(Math.ceil((n * 3) / 4) + 4);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, n);
}

/** unix seconds */
export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Constant-time string comparison (same length required for full protection;
 * we always compare equal-length hex strings for webhook secrets).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/**
 * Derive a per-bot webhook secret: HMAC-SHA256(webhookSecret, String(botId)) as hex.
 * Output is 64 lowercase hex chars — valid for Telegram's X-Telegram-Bot-Api-Secret-Token.
 */
export async function childWebhookSecret(webhookSecret: string, botId: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(botId)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

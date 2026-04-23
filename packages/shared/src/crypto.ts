/**
 * Runtime-neutral crypto helpers. Both Node 20+ (via `globalThis.crypto`) and
 * Cloudflare Workers expose the WebCrypto API, so this module has no
 * environment-specific branches.
 */

const DEVICE_TOKEN_BYTES = 32;

function getCrypto(): Crypto {
  // globalThis.crypto is available on Node 20+, Deno, Bun, and Workers.
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function" || !c.subtle) {
    throw new Error("WebCrypto is not available in this runtime");
  }
  return c;
}

function toBase64Url(bytes: Uint8Array): string {
  // atob/btoa are on globalThis in Node 20+ and Workers.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  const out = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]!.toString(16).padStart(2, "0");
  }
  return out.join("");
}

/** Generate a fresh device token: 32 random bytes, base64url-encoded. */
export function generateDeviceToken(): string {
  const bytes = new Uint8Array(DEVICE_TOKEN_BYTES);
  getCrypto().getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** SHA-256(token), hex. Stable across Node/Workers. */
export async function hashDeviceToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await getCrypto().subtle.digest("SHA-256", enc.encode(token));
  return toHex(new Uint8Array(digest));
}

/** Short prefix suitable for log lines — never log the full hash. */
export function hashPrefix(hashHex: string, n = 8): string {
  return hashHex.slice(0, n);
}

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

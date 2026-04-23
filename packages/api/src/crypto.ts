/** AES-256-GCM encrypt/decrypt for child-bot token storage. Format: iv(12) || ciphertext+tag. */

async function importKey(keyB64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(plaintext: string, keyB64: string): Promise<Uint8Array> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out;
}

export async function decryptToken(ivAndCt: Uint8Array, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = ivAndCt.slice(0, 12);
  const ct = ivAndCt.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plaintext);
}

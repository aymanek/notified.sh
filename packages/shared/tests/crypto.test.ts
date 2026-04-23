import { describe, it, expect } from "vitest";
import { generateDeviceToken, hashDeviceToken, hashPrefix } from "../src/crypto.js";

describe("generateDeviceToken", () => {
  it("returns a base64url string of the expected length", () => {
    const tok = generateDeviceToken();
    // 32 bytes → 43 base64url chars (no padding).
    expect(tok).toHaveLength(43);
    expect(tok).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is effectively unique across calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateDeviceToken());
    expect(tokens.size).toBe(100);
  });
});

describe("hashDeviceToken", () => {
  it("matches the known SHA-256 of 'abc'", async () => {
    const h = await hashDeviceToken("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic", async () => {
    const a = await hashDeviceToken("sometoken");
    const b = await hashDeviceToken("sometoken");
    expect(a).toBe(b);
  });

  it("produces 64-char lowercase hex", async () => {
    const h = await hashDeviceToken("any");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", async () => {
    const a = await hashDeviceToken("a");
    const b = await hashDeviceToken("b");
    expect(a).not.toBe(b);
  });
});

describe("hashPrefix", () => {
  it("returns the first n characters (default 8)", () => {
    const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(hashPrefix(hash)).toBe("ba7816bf");
    expect(hashPrefix(hash, 4)).toBe("ba78");
  });
});

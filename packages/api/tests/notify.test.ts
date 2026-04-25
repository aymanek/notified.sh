import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { hashDeviceToken } from "@notified.sh/shared";
import { encryptToken } from "../src/crypto.js";
import { nowSecs } from "../src/util.js";
import { resetDb } from "./d1-helpers.js";

const DEVICE_TOKEN = "test-device-token-abcdefghijklmnopqrstuvw";

async function seedUser() {
  const hash = await hashDeviceToken(DEVICE_TOKEN);
  const enc = await encryptToken("child-bot-token", env.AES_KEY_B64 as string);
  const now = nowSecs();
  await env.DB.prepare(
    `INSERT INTO users
     (device_token_hash, child_bot_id, child_bot_username, child_bot_token_enc, child_chat_id, created_at)
     VALUES (?, 999, 'testbot', ?, 12345, ?)`,
  )
    .bind(hash, enc, now)
    .run();
  return hash;
}

function notifyPost(body: unknown) {
  return SELF.fetch("https://notified.sh/v1/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEVICE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/notify", () => {
  beforeEach(resetDb);

  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("https://notified.sh/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset_at_unix: nowSecs() + 60, idempotency_key: "reset:123" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for bad body", async () => {
    await seedUser();
    const res = await notifyPost({ reset_at_unix: -1, idempotency_key: "" });
    expect(res.status).toBe(400);
  });

  it("schedules a notification and returns scheduled", async () => {
    const hash = await seedUser();
    const resetAt = nowSecs() + 120;
    const res = await notifyPost({
      reset_at_unix: resetAt,
      idempotency_key: `reset:${resetAt}`,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("scheduled");

    const row = await env.DB.prepare(
      "SELECT status, reset_at FROM notifications WHERE device_token_hash = ?",
    )
      .bind(hash)
      .first<{ status: string; reset_at: number }>();
    expect(row?.status).toBe("pending");
    expect(row?.reset_at).toBe(resetAt);
  });

  it("returns duplicate on second identical request", async () => {
    await seedUser();
    const resetAt = nowSecs() + 120;
    const body = { reset_at_unix: resetAt, idempotency_key: `reset-dup:${resetAt}` };

    const r1 = await notifyPost(body);
    expect(r1.status).toBe(201);

    const r2 = await notifyPost(body);
    expect(r2.status).toBe(200);
    const b2 = (await r2.json()) as { status: string };
    expect(b2.status).toBe("duplicate");
  });

  it("allows same idempotency_key for different users", async () => {
    await seedUser();

    // Second user with different token
    const token2 = "different-device-token-xyzxyzxyzxyzxyzx";
    const hash2 = await hashDeviceToken(token2);
    const enc2 = await encryptToken("other-bot-token", env.AES_KEY_B64 as string);
    await env.DB.prepare(
      `INSERT INTO users
       (device_token_hash, child_bot_id, child_bot_username, child_bot_token_enc, child_chat_id, created_at)
       VALUES (?, 888, 'otherbot', ?, 54321, ?)`,
    )
      .bind(hash2, enc2, nowSecs())
      .run();

    const resetAt = nowSecs() + 60;
    const key = `reset:${resetAt}`;

    const r1 = await notifyPost({ reset_at_unix: resetAt, idempotency_key: key });
    expect(r1.status).toBe(201);

    const r2 = await SELF.fetch("https://notified.sh/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ reset_at_unix: resetAt, idempotency_key: key }),
    });
    expect(r2.status).toBe(201); // Different user — not a duplicate
  });
});

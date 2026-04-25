import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashDeviceToken } from "@notified.sh/shared";
import { encryptToken } from "../src/crypto.js";
import { nowSecs } from "../src/util.js";
import { runDispatch } from "../src/dispatch.js";
import { resetDb } from "./d1-helpers.js";

const DEVICE_TOKEN = "dispatch-test-token-abcdefghijklmnopq";

async function seedUser(overrides: { hash?: string; child_bot_id?: number } = {}) {
  const hash = overrides.hash ?? (await hashDeviceToken(DEVICE_TOKEN));
  const enc = await encryptToken("child-bot-token", env.AES_KEY_B64 as string);
  const now = nowSecs();
  await env.DB.prepare(
    `INSERT INTO users
     (device_token_hash, child_bot_id, child_bot_username, child_bot_token_enc, child_chat_id, created_at)
     VALUES (?, ?, 'testbot', ?, 12345, ?)`,
  )
    .bind(hash, overrides.child_bot_id ?? 999, enc, now)
    .run();
  return hash;
}

async function insertNotification(hash: string, resetAt: number, status = "pending", claimedAt?: number) {
  const id = `notif-${Math.random().toString(36).slice(2)}`;
  await env.DB.prepare(
    `INSERT INTO notifications
     (id, device_token_hash, idempotency_key, reset_at, status, claimed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, hash, `reset:${resetAt}`, resetAt, status, claimedAt ?? null, nowSecs())
    .run();
  return id;
}

describe("runDispatch", () => {
  beforeEach(resetDb);
  afterEach(() => vi.unstubAllGlobals());

  function mockTgSuccess() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, result: {} }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  }

  function mockTgFailure(code: number, description: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error_code: code, description }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  }

  it("does nothing when no due notifications exist", async () => {
    const hash = await seedUser();
    const future = nowSecs() + 3600;
    await insertNotification(hash, future); // Not due yet
    await runDispatch(env as unknown as Parameters<typeof runDispatch>[0]);
    const row = await env.DB.prepare("SELECT status FROM notifications").first<{ status: string }>();
    expect(row?.status).toBe("pending");
  });

  it("sends due notification and marks it sent", async () => {
    mockTgSuccess();
    const hash = await seedUser();
    const past = nowSecs() - 10;
    const id = await insertNotification(hash, past);

    await runDispatch(env as unknown as Parameters<typeof runDispatch>[0]);

    const row = await env.DB.prepare("SELECT status FROM notifications WHERE id = ?")
      .bind(id)
      .first<{ status: string }>();
    expect(row?.status).toBe("sent");
  });

  it("marks notification failed when Telegram returns a bot error", async () => {
    mockTgFailure(403, "Forbidden: bot was blocked by the user");
    const hash = await seedUser();
    const past = nowSecs() - 10;
    const id = await insertNotification(hash, past);

    await runDispatch(env as unknown as Parameters<typeof runDispatch>[0]);

    const row = await env.DB.prepare("SELECT status, last_error FROM notifications WHERE id = ?")
      .bind(id)
      .first<{ status: string; last_error: string }>();
    expect(row?.status).toBe("failed");
    expect(row?.last_error).toContain("tg:403");
  });

  it("marks notification failed with user_gone when user row is missing", async () => {
    const hash = "nonexistent-hash";
    const past = nowSecs() - 10;
    const id = await insertNotification(hash, past);

    await runDispatch(env as unknown as Parameters<typeof runDispatch>[0]);

    const row = await env.DB.prepare("SELECT status, last_error FROM notifications WHERE id = ?")
      .bind(id)
      .first<{ status: string; last_error: string }>();
    expect(row?.status).toBe("failed");
    expect(row?.last_error).toBe("user_gone");
  });

  it("reaps stuck sending rows and re-delivers them", async () => {
    mockTgSuccess();
    const hash = await seedUser();
    // Insert a row stuck in 'sending' with claimed_at older than STALE_SECONDS
    const past = nowSecs() - 10;
    const staleClaimedAt = nowSecs() - STALE_CLAIMED_DELTA;
    const id = await insertNotification(hash, past, "sending", staleClaimedAt);

    await runDispatch(env as unknown as Parameters<typeof runDispatch>[0]);

    // After reap→claim→dispatch, the row should be delivered
    const row = await env.DB.prepare("SELECT status FROM notifications WHERE id = ?")
      .bind(id)
      .first<{ status: string }>();
    expect(row?.status).toBe("sent");
  });

  it("prevents double-send: claiming is atomic", async () => {
    mockTgSuccess();
    const hash = await seedUser();
    const past = nowSecs() - 10;
    const id = await insertNotification(hash, past);

    // Simulate two concurrent dispatches
    await Promise.all([
      runDispatch(env as unknown as Parameters<typeof runDispatch>[0]),
      runDispatch(env as unknown as Parameters<typeof runDispatch>[0]),
    ]);

    const row = await env.DB.prepare("SELECT status FROM notifications WHERE id = ?")
      .bind(id)
      .first<{ status: string }>();
    expect(row?.status).toBe("sent");

    // sendMessage should have been called exactly once
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(calls).toBe(1);
  });
});

// Reap threshold: rows with claimed_at <= now - 300 (STALE_SECONDS in dispatch.ts)
const STALE_CLAIMED_DELTA = 310;

import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptToken } from "../src/crypto.js";
import { nowSecs } from "../src/util.js";
import { resetDb } from "./d1-helpers.js";

const WEBHOOK_SECRET = "0".repeat(64); // matches vitest.config.ts bindings
const BOT_ID = 987654321;
const BOT_USERNAME = "notified_test123_bot";

function makeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    managed_bot: {
      bot: { id: BOT_ID, username: BOT_USERNAME, first_name: "Test", is_bot: true },
      ...overrides,
    },
  };
}

function managerPost(body: unknown) {
  return SELF.fetch("https://notified.sh/v1/tg/manager", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/tg/manager", () => {
  beforeEach(async () => {
    await resetDb();
    // Stub global fetch to intercept Telegram API calls.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        if (u.includes("getManagedBotToken")) {
          return new Response(JSON.stringify({ ok: true, result: "child-bot-token-xyz" }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("setWebhook")) {
          return new Response(JSON.stringify({ ok: true, result: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        // Fallthrough to real fetch for D1 / worker internal calls
        return new Response(JSON.stringify({ ok: false, error_code: 0, description: "unmocked" }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 403 for wrong secret", async () => {
    const res = await SELF.fetch("https://notified.sh/v1/tg/manager", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrongsecret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 and acknowledges unknown update kinds", async () => {
    const res = await managerPost({ update_id: 1, message: { text: "hello" } });
    expect(res.status).toBe(200);
  });

  it("ignores managed_bot with no matching pending session", async () => {
    const res = await managerPost(makeUpdate());
    expect(res.status).toBe(200);
    // No session row should be affected
    const row = await env.DB.prepare("SELECT * FROM pairing_sessions").first();
    expect(row).toBeNull();
  });

  it("advances pending session to awaiting_start on managed_bot creation", async () => {
    const now = nowSecs();
    await env.DB.prepare(
      `INSERT INTO pairing_sessions
       (session_id, suggested_username, status, created_at, expires_at)
       VALUES ('sess01', ?, 'pending', ?, ?)`,
    )
      .bind(BOT_USERNAME, now, now + 600)
      .run();

    const res = await managerPost(makeUpdate());
    expect(res.status).toBe(200);

    const session = await env.DB.prepare(
      "SELECT status, child_bot_id, child_bot_username FROM pairing_sessions WHERE session_id = 'sess01'",
    ).first<{ status: string; child_bot_id: number; child_bot_username: string }>();

    expect(session?.status).toBe("awaiting_start");
    expect(session?.child_bot_id).toBe(BOT_ID);
    expect(session?.child_bot_username).toBe(BOT_USERNAME);
  });

  it("re-encrypts token on rotation update", async () => {
    const now = nowSecs();
    const enc = await encryptToken("original-token", env.AES_KEY_B64 as string);
    await env.DB.prepare(
      `INSERT INTO users
       (device_token_hash, child_bot_id, child_bot_username, child_bot_token_enc, child_chat_id, created_at)
       VALUES ('hash123', ?, 'somebot', ?, 99999, ?)`,
    )
      .bind(BOT_ID, enc, now)
      .run();

    const res = await managerPost({ update_id: 2, managed_bot: { bot: { id: BOT_ID, username: BOT_USERNAME, first_name: "Bot", is_bot: true }, token: "new-token" } });
    expect(res.status).toBe(200);

    const user = await env.DB.prepare("SELECT child_bot_token_enc FROM users WHERE child_bot_id = ?")
      .bind(BOT_ID)
      .first<{ child_bot_token_enc: ArrayBuffer }>();

    expect(user).not.toBeNull();
    // Encrypted value should have changed (new token was stored)
    expect(user!.child_bot_token_enc).not.toEqual(enc.buffer);
  });
});

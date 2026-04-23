import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptToken } from "../src/crypto.js";
import { childWebhookSecret, nowSecs } from "../src/util.js";
import { resetDb } from "./d1-helpers.js";

const BOT_ID = 111222333;
const CHAT_ID = 987654321;

async function getChildSecret() {
  return childWebhookSecret("0".repeat(64), BOT_ID);
}

async function childPost(body: unknown, secret?: string) {
  const s = secret ?? (await getChildSecret());
  return SELF.fetch(`https://notified.sh/v1/tg/child/${BOT_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": s,
    },
    body: JSON.stringify(body),
  });
}

function startUpdate() {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: CHAT_ID },
      from: { id: CHAT_ID },
      text: "/start",
    },
  };
}

describe("POST /v1/tg/child/:bot_id", () => {
  beforeEach(async () => {
    await resetDb();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, result: {} }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 403 for wrong secret", async () => {
    const res = await childPost(startUpdate(), "wrongsecret");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric bot_id", async () => {
    const res = await SELF.fetch("https://notified.sh/v1/tg/child/abc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": await getChildSecret(),
      },
      body: JSON.stringify(startUpdate()),
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 and ignores non-/start messages", async () => {
    const res = await childPost({
      update_id: 1,
      message: { message_id: 1, chat: { id: CHAT_ID }, text: "hello" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 and ignores /start with no matching session", async () => {
    const res = await childPost(startUpdate());
    expect(res.status).toBe(200);
  });

  it("completes pairing on /start with awaiting_start session", async () => {
    const now = nowSecs();
    const enc = await encryptToken("child-bot-token", env.AES_KEY_B64 as string);
    await env.DB.prepare(
      `INSERT INTO pairing_sessions
       (session_id, suggested_username, status, created_at, expires_at,
        child_bot_id, child_bot_username, child_bot_token_enc)
       VALUES ('sess01', 'notified_test_bot', 'awaiting_start', ?, ?, ?, 'notified_test_bot', ?)`,
    )
      .bind(now, now + 600, BOT_ID, enc)
      .run();

    const res = await childPost(startUpdate());
    expect(res.status).toBe(200);

    // Session should be complete with one-time token set
    const session = await env.DB.prepare(
      "SELECT status, device_token_onetime, device_token_hash, child_chat_id FROM pairing_sessions WHERE session_id = 'sess01'",
    ).first<{ status: string; device_token_onetime: string | null; device_token_hash: string | null; child_chat_id: number | null }>();

    expect(session?.status).toBe("complete");
    expect(typeof session?.device_token_onetime).toBe("string");
    expect(session?.device_token_onetime?.length).toBeGreaterThan(0);
    expect(session?.device_token_hash).toBeTruthy();
    expect(session?.child_chat_id).toBe(CHAT_ID);

    // Users row should exist
    const user = await env.DB.prepare(
      "SELECT child_bot_id, child_chat_id FROM users WHERE device_token_hash = ?",
    )
      .bind(session!.device_token_hash)
      .first<{ child_bot_id: number; child_chat_id: number }>();

    expect(user?.child_bot_id).toBe(BOT_ID);
    expect(user?.child_chat_id).toBe(CHAT_ID);
  });
});

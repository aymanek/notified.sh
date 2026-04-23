import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { nowSecs } from "../src/util.js";
import { resetDb } from "./d1-helpers.js";

describe("POST /v1/pair", () => {
  beforeEach(resetDb);

  it("creates a session and returns expected fields", async () => {
    const res = await SELF.fetch("https://notified.sh/v1/pair", { method: "POST" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.session_id).toBe("string");
    expect((body.session_id as string).length).toBe(16);
    expect(typeof body.deep_link).toBe("string");
    expect(body.deep_link).toContain("t.me/newbot/testmanagerbot/notified_");
    expect(typeof body.qr_data).toBe("string");
    expect(typeof body.expires_at).toBe("number");
    expect(body.expires_at as number).toBeGreaterThan(nowSecs());
  });

  it("creates two sessions with unique session_ids", async () => {
    const a = (await (await SELF.fetch("https://notified.sh/v1/pair", { method: "POST" })).json()) as {
      session_id: string;
    };
    const b = (await (await SELF.fetch("https://notified.sh/v1/pair", { method: "POST" })).json()) as {
      session_id: string;
    };
    expect(a.session_id).not.toBe(b.session_id);
  });
});

describe("GET /v1/pair/:session_id", () => {
  beforeEach(resetDb);

  it("returns 404 for unknown session", async () => {
    const res = await SELF.fetch("https://notified.sh/v1/pair/doesnotexist");
    expect(res.status).toBe(404);
  });

  it("returns pending for a fresh session", async () => {
    const { session_id } = (await (
      await SELF.fetch("https://notified.sh/v1/pair", { method: "POST" })
    ).json()) as { session_id: string };

    const res = await SELF.fetch(`https://notified.sh/v1/pair/${session_id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("pending");
  });

  it("returns expired when expires_at is in the past", async () => {
    const now = nowSecs();
    // Insert a session that expired 60s ago
    await env.DB.prepare(
      `INSERT INTO pairing_sessions
       (session_id, suggested_username, status, created_at, expires_at)
       VALUES ('stale01', 'notified_stale01_bot', 'pending', ?, ?)`,
    )
      .bind(now - 660, now - 60)
      .run();

    const res = await SELF.fetch("https://notified.sh/v1/pair/stale01");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("expired");
  });

  it("returns awaiting_start with child_bot_username", async () => {
    const now = nowSecs();
    await env.DB.prepare(
      `INSERT INTO pairing_sessions
       (session_id, suggested_username, status, created_at, expires_at, child_bot_username)
       VALUES ('await01', 'notified_await01_bot', 'awaiting_start', ?, ?, 'notified_await01_bot')`,
    )
      .bind(now, now + 600)
      .run();

    const res = await SELF.fetch("https://notified.sh/v1/pair/await01");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; child_bot_username: string };
    expect(body.status).toBe("awaiting_start");
    expect(body.child_bot_username).toBe("notified_await01_bot");
  });

  it("returns complete and issues device_token once then clears it", async () => {
    const now = nowSecs();
    await env.DB.prepare(
      `INSERT INTO pairing_sessions
       (session_id, suggested_username, status, created_at, expires_at,
        child_bot_username, device_token_hash, device_token_onetime)
       VALUES ('done01', 'notified_done01_bot', 'complete', ?, ?,
        'notified_done01_bot', 'hash_abc', 'plaintext_token_xyz')`,
    )
      .bind(now, now + 600)
      .run();

    // First poll: should return device_token
    const res1 = await SELF.fetch("https://notified.sh/v1/pair/done01");
    const body1 = (await res1.json()) as { status: string; device_token?: string };
    expect(body1.status).toBe("complete");
    expect(body1.device_token).toBe("plaintext_token_xyz");

    // Second poll: device_token must be gone
    const res2 = await SELF.fetch("https://notified.sh/v1/pair/done01");
    const body2 = (await res2.json()) as { status: string; device_token?: string };
    expect(body2.status).toBe("complete");
    expect(body2.device_token).toBeUndefined();
  });
});

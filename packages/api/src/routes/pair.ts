import { Hono } from "hono";
import { PAIR_SESSION_TTL_SECONDS } from "@notified.sh/shared";
import type { HonoEnv } from "../env.js";
import type { PairingSession } from "../db.js";
import { nanoid, nowSecs } from "../util.js";
import { getMe } from "../tg.js";
import { log } from "../log.js";

// Cache within the Worker instance lifetime — avoids a getMe call on every pair request.
let cachedManagerUsername: string | null = null;
async function managerUsername(token: string, envOverride?: string): Promise<string> {
  if (envOverride) return envOverride;
  if (!cachedManagerUsername) {
    const bot = await getMe(token);
    cachedManagerUsername = bot.username;
  }
  return cachedManagerUsername;
}

export const pairRoute = new Hono<HonoEnv>();

// POST /v1/pair — create a new pairing session
pairRoute.post("/v1/pair", async (c) => {
  // Rate limit: 30 req/min per IP
  if (c.env.RL_PAIR) {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const { success } = await c.env.RL_PAIR.limit({ key: ip });
    if (!success) {
      return c.json({ error: { code: "rate_limited", message: "Too many requests." } }, 429);
    }
  }

  const session_id = nanoid(16);
  const suggested_username = `notified_${nanoid(8)}_bot`;
  const now = nowSecs();
  const expires_at = now + PAIR_SESSION_TTL_SECONDS;
  const mgr = await managerUsername(c.env.MANAGER_BOT_TOKEN, c.env.MANAGER_BOT_USERNAME);
  const deep_link = `https://t.me/newbot/${mgr}/${suggested_username}?name=notified.sh`;

  await c.env.DB.prepare(
    `INSERT INTO pairing_sessions
     (session_id, suggested_username, status, created_at, expires_at)
     VALUES (?, ?, 'pending', ?, ?)`,
  )
    .bind(session_id, suggested_username, now, expires_at)
    .run();

  log({ event: "pair_created", session_id });

  return c.json(
    {
      session_id,
      deep_link,
      qr_data: deep_link,
      expires_at,
    },
    201,
  );
});

// GET /v1/pair/:session_id — poll for pairing status
pairRoute.get("/v1/pair/:session_id", async (c) => {
  const { session_id } = c.req.param();
  const now = nowSecs();

  const session = await c.env.DB.prepare(
    "SELECT * FROM pairing_sessions WHERE session_id = ?",
  )
    .bind(session_id)
    .first<PairingSession>();

  if (!session) {
    return c.json({ error: { code: "not_found", message: "Session not found." } }, 404);
  }

  // Mark expired if TTL elapsed (lazy expiry)
  if (session.status === "pending" && session.expires_at < now) {
    await c.env.DB.prepare(
      "UPDATE pairing_sessions SET status = 'expired' WHERE session_id = ?",
    )
      .bind(session_id)
      .run();
    return c.json({ status: "expired" });
  }

  if (session.status === "expired") {
    return c.json({ status: "expired" });
  }

  if (session.status === "pending") {
    return c.json({ status: "pending" });
  }

  if (session.status === "awaiting_start") {
    return c.json({
      status: "awaiting_start",
      child_bot_username: session.child_bot_username,
    });
  }

  // status === "complete"
  if (session.device_token_onetime) {
    // Return the one-time token and immediately clear it — single read guarantee.
    const device_token = session.device_token_onetime;
    await c.env.DB.prepare(
      "UPDATE pairing_sessions SET device_token_onetime = NULL WHERE session_id = ?",
    )
      .bind(session_id)
      .run();
    log({ event: "pair_complete_token_issued", session_id });
    return c.json({
      status: "complete",
      child_bot_username: session.child_bot_username,
      device_token,
    });
  }

  return c.json({
    status: "complete",
    child_bot_username: session.child_bot_username,
  });
});

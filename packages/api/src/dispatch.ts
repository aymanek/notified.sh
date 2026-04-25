import type { Env } from "./env.js";
import type { User, Notification } from "./db.js";
import { decryptToken } from "./crypto.js";
import { sendMessage, TgError } from "./tg.js";
import { messageFor, hashPrefix } from "@notified.sh/shared";
import { nowSecs } from "./util.js";
import { log } from "./log.js";

const CLAIM_LIMIT = 50;
const STALE_SECONDS = 300; // 5 min — reap stuck "sending" rows

/** Full cron tick: reap → GC → claim → dispatch. */
export async function runDispatch(env: Env): Promise<void> {
  const now = nowSecs();

  await reapStuck(env, now);
  await gc(env, now);

  const claimed = await claimDue(env, now);
  if (claimed.length === 0) return;

  log({ event: "dispatch_batch", count: claimed.length } as never);

  await Promise.allSettled(claimed.map((n) => dispatchOne(env, n)));
}

async function reapStuck(env: Env, now: number): Promise<void> {
  const { meta } = await env.DB.prepare(
    `UPDATE notifications SET status = 'pending', claimed_at = NULL
     WHERE status = 'sending' AND claimed_at IS NOT NULL AND claimed_at <= ?`,
  )
    .bind(now - STALE_SECONDS)
    .run();
  if (meta.changes > 0) log({ event: "dispatch_reap", count: meta.changes } as never);
}

async function gc(env: Env, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM pairing_sessions WHERE expires_at < ? AND status != 'complete'",
    ).bind(now),
    env.DB.prepare(
      "DELETE FROM pairing_sessions WHERE status = 'complete' AND created_at < ?",
    ).bind(now - 86400),
    env.DB.prepare(
      "DELETE FROM notifications WHERE status IN ('sent','failed') AND sent_at < ?",
    ).bind(now - 2_592_000), // 30 days
  ]);
}

async function claimDue(env: Env, now: number): Promise<Notification[]> {
  const { results } = await env.DB.prepare(
    `UPDATE notifications
     SET status = 'sending', claimed_at = ?
     WHERE id IN (
       SELECT id FROM notifications
       WHERE status = 'pending' AND reset_at <= ?
       ORDER BY reset_at ASC
       LIMIT ?
     )
     RETURNING id, device_token_hash, idempotency_key, reset_at,
               status, claimed_at, created_at, sent_at, last_error`,
  )
    .bind(now, now, CLAIM_LIMIT)
    .all<Notification>();
  return results;
}

async function dispatchOne(env: Env, n: Notification): Promise<void> {
  const now = nowSecs();

  const user = await env.DB.prepare("SELECT * FROM users WHERE device_token_hash = ?")
    .bind(n.device_token_hash)
    .first<User>();

  if (!user) {
    await env.DB.prepare(
      "UPDATE notifications SET status = 'failed', last_error = 'user_gone', sent_at = ? WHERE id = ?",
    )
      .bind(now, n.id)
      .run();
    log({ event: "dispatch_user_gone", user_prefix: hashPrefix(n.device_token_hash) });
    return;
  }

  try {
    const token = await decryptToken(
      new Uint8Array(user.child_bot_token_enc as unknown as ArrayBuffer),
      env.AES_KEY_B64,
    );
    await sendMessage(token, user.child_chat_id, messageFor());

    await env.DB.batch([
      env.DB.prepare(
        "UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?",
      ).bind(now, n.id),
      env.DB.prepare(
        "UPDATE users SET last_notified_at = ? WHERE device_token_hash = ?",
      ).bind(now, n.device_token_hash),
    ]);

    log({ event: "dispatch_sent", user_prefix: hashPrefix(n.device_token_hash) });
  } catch (err) {
    const code = err instanceof TgError ? `tg:${err.code}` : "network";
    const revert = code.startsWith("network");

    if (revert) {
      // Transient error — revert to pending so next cron tick retries.
      await env.DB.prepare("UPDATE notifications SET status = 'pending' WHERE id = ?").bind(n.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE notifications SET status = 'failed', last_error = ?, sent_at = ? WHERE id = ?",
      )
        .bind(code, now, n.id)
        .run();
    }

    log({ event: "dispatch_failed", user_prefix: hashPrefix(n.device_token_hash), err_code: code });
  }
}

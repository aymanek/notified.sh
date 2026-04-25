import { env } from "cloudflare:test";

const DDL = [
  `CREATE TABLE IF NOT EXISTS pairing_sessions (
    session_id          TEXT    PRIMARY KEY,
    suggested_username  TEXT    NOT NULL UNIQUE,
    status              TEXT    NOT NULL CHECK (status IN ('pending','awaiting_start','complete','expired')),
    created_at          INTEGER NOT NULL,
    expires_at          INTEGER NOT NULL,
    child_bot_id        INTEGER,
    child_bot_username  TEXT,
    child_bot_token_enc BLOB,
    child_chat_id       INTEGER,
    device_token_hash   TEXT,
    device_token_onetime TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    device_token_hash   TEXT    PRIMARY KEY,
    child_bot_id        INTEGER NOT NULL UNIQUE,
    child_bot_username  TEXT    NOT NULL,
    child_bot_token_enc BLOB    NOT NULL,
    child_chat_id       INTEGER NOT NULL,
    created_at          INTEGER NOT NULL,
    last_notified_at    INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id                TEXT    PRIMARY KEY,
    device_token_hash TEXT    NOT NULL,
    limit_kind        TEXT    NOT NULL CHECK (limit_kind IN ('session','weekly')),
    idempotency_key   TEXT    NOT NULL,
    reset_at          INTEGER NOT NULL,
    status            TEXT    NOT NULL CHECK (status IN ('pending','sending','sent','failed')),
    created_at        INTEGER NOT NULL,
    claimed_at        INTEGER,
    sent_at           INTEGER,
    last_error        TEXT,
    UNIQUE (device_token_hash, idempotency_key)
  )`,
];

const TRUNCATE = [
  "DELETE FROM notifications",
  "DELETE FROM users",
  "DELETE FROM pairing_sessions",
];

/** Ensures schema exists and truncates all rows. Call in beforeEach. */
export async function resetDb(): Promise<void> {
  for (const sql of DDL) {
    await env.DB.prepare(sql).run();
  }
  for (const sql of TRUNCATE) {
    await env.DB.prepare(sql).run();
  }
}

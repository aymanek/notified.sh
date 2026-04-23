CREATE TABLE pairing_sessions (
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
  device_token_onetime TEXT              -- plaintext, cleared on first poll after complete
);
CREATE INDEX idx_sessions_child_bot ON pairing_sessions(child_bot_id);
CREATE INDEX idx_sessions_expires   ON pairing_sessions(expires_at);

CREATE TABLE users (
  device_token_hash   TEXT    PRIMARY KEY,
  child_bot_id        INTEGER NOT NULL UNIQUE,
  child_bot_username  TEXT    NOT NULL,
  child_bot_token_enc BLOB    NOT NULL,
  child_chat_id       INTEGER NOT NULL,
  created_at          INTEGER NOT NULL,
  last_notified_at    INTEGER
);

CREATE TABLE notifications (
  id                TEXT    PRIMARY KEY,
  device_token_hash TEXT    NOT NULL,
  limit_kind        TEXT    NOT NULL CHECK (limit_kind IN ('session','weekly')),
  idempotency_key   TEXT    NOT NULL,
  reset_at          INTEGER NOT NULL,
  status            TEXT    NOT NULL CHECK (status IN ('pending','sending','sent','failed')),
  created_at        INTEGER NOT NULL,
  sent_at           INTEGER,
  last_error        TEXT,
  UNIQUE (device_token_hash, idempotency_key)
);
CREATE INDEX idx_notifications_due  ON notifications(status, reset_at);
CREATE INDEX idx_notifications_user ON notifications(device_token_hash);

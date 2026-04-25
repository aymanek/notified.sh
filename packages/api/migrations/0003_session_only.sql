-- Tighten limit_kind constraint to session-only.
-- SQLite cannot ALTER CHECK in place; rebuild table preserving all rows.
-- (Any pre-existing 'weekly' rows would be dropped — none exist in production
--  at deploy time of this migration.)

CREATE TABLE notifications_new (
  id                TEXT    PRIMARY KEY,
  device_token_hash TEXT    NOT NULL,
  limit_kind        TEXT    NOT NULL CHECK (limit_kind = 'session'),
  idempotency_key   TEXT    NOT NULL,
  reset_at          INTEGER NOT NULL,
  status            TEXT    NOT NULL CHECK (status IN ('pending','sending','sent','failed')),
  created_at        INTEGER NOT NULL,
  claimed_at        INTEGER,
  sent_at           INTEGER,
  last_error        TEXT,
  UNIQUE (device_token_hash, idempotency_key)
);

INSERT INTO notifications_new
  (id, device_token_hash, limit_kind, idempotency_key, reset_at, status, created_at, claimed_at, sent_at, last_error)
SELECT id, device_token_hash, limit_kind, idempotency_key, reset_at, status, created_at, claimed_at, sent_at, last_error
FROM notifications
WHERE limit_kind = 'session';

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX idx_notifications_due  ON notifications(status, reset_at);
CREATE INDEX idx_notifications_user ON notifications(device_token_hash);

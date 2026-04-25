-- Remove the old session/weekly discriminator. Notifications are now keyed by
-- reset time only, with duplicate protection scoped per device_token_hash.

CREATE TABLE notifications_new (
  id                TEXT    PRIMARY KEY,
  device_token_hash TEXT    NOT NULL,
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
  (id, device_token_hash, idempotency_key, reset_at, status, created_at, claimed_at, sent_at, last_error)
SELECT id, device_token_hash, idempotency_key, reset_at, status, created_at, claimed_at, sent_at, last_error
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX idx_notifications_due  ON notifications(status, reset_at);
CREATE INDEX idx_notifications_user ON notifications(device_token_hash);

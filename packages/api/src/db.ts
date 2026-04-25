/** Typed row shapes for D1 query results. */

export type SessionStatus = "pending" | "awaiting_start" | "complete" | "expired";

export type PairingSession = {
  session_id: string;
  suggested_username: string;
  status: SessionStatus;
  created_at: number;
  expires_at: number;
  child_bot_id: number | null;
  child_bot_username: string | null;
  child_bot_token_enc: ArrayBuffer | null;
  child_chat_id: number | null;
  device_token_hash: string | null;
  device_token_onetime: string | null;
};

export type User = {
  device_token_hash: string;
  child_bot_id: number;
  child_bot_username: string;
  child_bot_token_enc: ArrayBuffer;
  child_chat_id: number;
  created_at: number;
  last_notified_at: number | null;
};

export type NotificationStatus = "pending" | "sending" | "sent" | "failed";

export type Notification = {
  id: string;
  device_token_hash: string;
  idempotency_key: string;
  reset_at: number;
  status: NotificationStatus;
  created_at: number;
  claimed_at: number | null;
  sent_at: number | null;
  last_error: string | null;
};

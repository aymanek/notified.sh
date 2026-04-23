type LogFields = {
  event: string;
  session_id?: string;
  bot_id?: number | string;
  /** First 8 hex chars of device_token_hash — never the full hash or plaintext token. */
  user_prefix?: string;
  err_code?: string | number;
  [key: string]: unknown;
};

/** Emit a structured JSON log line. Never log tokens, chat_ids, or message content. */
export function log(fields: LogFields): void {
  console.log(JSON.stringify({ ts: Date.now(), ...fields }));
}

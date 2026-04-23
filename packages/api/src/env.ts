/** Rate limiting binding shape (Cloudflare Workers Rate Limiting API). */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Worker environment bindings + secrets. */
export interface Env {
  // D1 database
  DB: D1Database;
  // Worker secrets (set via `wrangler secret put`)
  MANAGER_BOT_TOKEN: string;
  MANAGER_BOT_USERNAME: string;
  /** Base64-encoded 32-byte AES-256 key for child-bot token encryption. */
  AES_KEY_B64: string;
  /** 64-hex-char secret: manager webhook auth + HMAC base for child webhooks. */
  TG_WEBHOOK_SECRET: string;
  // Rate limiting bindings
  RL_PAIR: RateLimit;
  RL_NOTIFY: RateLimit;
  // Non-secret vars
  APP_VERSION: string;
}

/** Per-request variables set by middleware (available via c.get / c.set). */
export interface Vars {
  deviceTokenHash: string;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: Vars;
};

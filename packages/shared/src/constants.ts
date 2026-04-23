export const API_VERSION = "v1";

export const DEFAULT_API_BASE = "https://api.notified.sh";

export const PAIR_SESSION_TTL_SECONDS = 10 * 60;
export const PAIR_POLL_INTERVAL_MS = 2_000;
export const PAIR_POLL_TIMEOUT_MS = PAIR_SESSION_TTL_SECONDS * 1_000;

/**
 * Endpoint path helpers. All API calls go through these so that path drift
 * between CLI and API is a typecheck-time failure.
 */
export const PATHS = {
  health: "/health",
  pair: `/${API_VERSION}/pair`,
  pairSession: (sessionId: string) => `/${API_VERSION}/pair/${encodeURIComponent(sessionId)}`,
  tgManager: `/${API_VERSION}/tg/manager`,
  tgChild: (botId: number | string) => `/${API_VERSION}/tg/child/${botId}`,
  notify: `/${API_VERSION}/notify`,
  test: `/${API_VERSION}/test`,
  unpair: `/${API_VERSION}/unpair`,
} as const;

import { loadConfig, resolvedApiBase } from "../config.js";
import { loadState, saveState } from "../state.js";
import { post } from "../api-client.js";
import { NotifyResponseSchema } from "@notified.sh/shared";
import {
  transcriptPathFromStdin,
  findMostRecentTranscript,
  readRateLimitLines,
} from "../detect/jsonl.js";
import { detectRateLimit } from "../detect/matcher.js";

const HOOK_TIMEOUT_MS = 3_000;

export async function runHookStop(): Promise<void> {
  const config = await loadConfig();
  if (!config) return;

  // 1. Find the transcript to scan
  const transcriptPath =
    (await transcriptPathFromStdin()) ?? (await findMostRecentTranscript());
  if (!transcriptPath) return;

  // 2. Read rate-limit lines
  const lines = await readRateLimitLines(transcriptPath);
  if (lines.length === 0) return;

  // 3. Detect
  const detection = detectRateLimit(lines);
  if (!detection) return;

  const { limit_kind, reset_at } = detection;
  const idempotency_key = `${limit_kind}:${reset_at}`;
  const apiBase = resolvedApiBase(config);

  // 4. Load state + flush pending from previous failed runs first
  const state = await loadState();
  if (state.pending_submit.length > 0) {
    await flushPending(state, config, apiBase);
  }

  // 5. Dedup: check submitted AND still-pending (after flush) to avoid double-POST
  const alreadyDone =
    state.submitted.some((e) => e.idempotency_key === idempotency_key) ||
    state.pending_submit.some((e) => e.idempotency_key === idempotency_key);

  if (alreadyDone) {
    await saveState(state);
    return;
  }

  // 6. POST /v1/notify
  try {
    const res = await post(
      NotifyResponseSchema,
      `${apiBase}/v1/notify`,
      { limit_kind, reset_at_unix: reset_at, idempotency_key },
      config.device_token,
      HOOK_TIMEOUT_MS,
    );

    if (res.status === "scheduled" || res.status === "duplicate") {
      state.submitted.push({
        idempotency_key,
        submitted_at: Math.floor(Date.now() / 1000),
        limit_kind,
        reset_at,
      });
    }
  } catch (err: unknown) {
    state.pending_submit.push({
      idempotency_key,
      limit_kind,
      reset_at,
      last_error: err instanceof Error ? err.message : String(err),
    });
  }

  await saveState(state);
}

async function flushPending(
  state: ReturnType<typeof loadState> extends Promise<infer T> ? T : never,
  config: Awaited<ReturnType<typeof loadConfig>> & object,
  apiBase: string,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const stillPending: typeof state.pending_submit = [];

  for (const entry of state.pending_submit) {
    if (entry.reset_at < nowSec - 3600) continue; // stale, skip
    if (state.submitted.some((e) => e.idempotency_key === entry.idempotency_key)) continue;

    try {
      const res = await post(
        NotifyResponseSchema,
        `${apiBase}/v1/notify`,
        {
          limit_kind: entry.limit_kind,
          reset_at_unix: entry.reset_at,
          idempotency_key: entry.idempotency_key,
        },
        config.device_token,
        HOOK_TIMEOUT_MS,
      );
      if (res.status === "scheduled" || res.status === "duplicate") {
        state.submitted.push({
          idempotency_key: entry.idempotency_key,
          submitted_at: nowSec,
          limit_kind: entry.limit_kind,
          reset_at: entry.reset_at,
        });
      } else {
        stillPending.push(entry);
      }
    } catch {
      stillPending.push({ ...entry });
    }
  }

  state.pending_submit = stillPending;
}

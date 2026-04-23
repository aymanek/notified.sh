import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import type { LimitKind } from "@notified.sh/shared";
import { STATE_FILE } from "./paths.js";

const MAX_SUBMITTED = 500;
const SUBMITTED_TTL_DAYS = 14;

export type SubmittedEntry = {
  idempotency_key: string;
  submitted_at: number;
  limit_kind: LimitKind;
  reset_at: number;
};

export type PendingEntry = {
  idempotency_key: string;
  limit_kind: LimitKind;
  reset_at: number;
  last_error?: string;
};

export type State = {
  submitted: SubmittedEntry[];
  pending_submit: PendingEntry[];
};

const EMPTY: State = { submitted: [], pending_submit: [] };

export async function loadState(): Promise<State> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as State;
  } catch {
    return { ...EMPTY };
  }
}

export async function saveState(state: State): Promise<void> {
  // GC: prune submitted entries older than 14d, cap at 500
  const cutoff = Date.now() / 1000 - SUBMITTED_TTL_DAYS * 86400;
  state.submitted = state.submitted.filter((e) => e.submitted_at > cutoff).slice(-MAX_SUBMITTED);

  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600, flag: "w" });
}

export async function deleteState(): Promise<void> {
  const { unlink } = await import("fs/promises");
  try {
    await unlink(STATE_FILE);
  } catch {
    // Ignore if already gone
  }
}

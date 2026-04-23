import { z } from "zod";

/**
 * Claude Code has (at least) two distinct rate-limit domains, and the product
 * must treat them as explicitly typed events end-to-end — detection, transport,
 * storage, and notification copy all branch on this.
 */
export const LimitKindSchema = z.enum(["session", "weekly"]);
export type LimitKind = z.infer<typeof LimitKindSchema>;

export const ConfidenceSchema = z.enum(["high", "medium"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * The internal event shape produced by the CLI's JSONL detector and submitted
 * to the API for scheduled delivery.
 */
export const DetectedLimitEventSchema = z.object({
  limit_kind: LimitKindSchema,
  reset_at: z.number().int().positive(),
  source: z.literal("claude_jsonl"),
  confidence: ConfidenceSchema,
  idempotency_key: z.string().min(1).max(200),
});
export type DetectedLimitEvent = z.infer<typeof DetectedLimitEventSchema>;

const MESSAGES: Record<LimitKind, string> = {
  session: "⏰ Claude Code session limit reset. You're good to go.",
  weekly: "📅 Claude Code weekly limit reset. You're good to go.",
};

/** Telegram message template for a given limit reset event. */
export function messageFor(kind: LimitKind): string {
  return MESSAGES[kind];
}

/** Canonical idempotency key for a detected event. */
export function idempotencyKeyFor(kind: LimitKind, resetAt: number): string {
  return `${kind}:${resetAt}`;
}

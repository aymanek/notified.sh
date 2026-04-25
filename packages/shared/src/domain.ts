import { z } from "zod";

export const ConfidenceSchema = z.enum(["high", "medium"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const DetectedLimitEventSchema = z.object({
  reset_at: z.number().int().positive(),
  source: z.literal("claude_jsonl"),
  confidence: ConfidenceSchema,
  idempotency_key: z.string().min(1).max(200),
});
export type DetectedLimitEvent = z.infer<typeof DetectedLimitEventSchema>;

const MESSAGE = "⏰ Claude Code limit reset. You're good to go.";

/** Telegram message for a limit reset notification. */
export function messageFor(): string {
  return MESSAGE;
}

/** Canonical idempotency key for a detected event. */
export function idempotencyKeyFor(resetAt: number): string {
  return `reset:${resetAt}`;
}

import { z } from "zod";

// --- pair -------------------------------------------------------------------

export const PairStartResponseSchema = z.object({
  session_id: z.string().min(1),
  deep_link: z.string().url(),
  qr_data: z.string().min(1),
  expires_at: z.number().int().positive(),
});
export type PairStartResponse = z.infer<typeof PairStartResponseSchema>;

export const PairStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("awaiting_start"),
    child_bot_username: z.string().min(1),
  }),
  z.object({
    status: z.literal("complete"),
    child_bot_username: z.string().min(1),
    /** Present exactly once on the first poll that observes `complete`. */
    device_token: z.string().min(1).optional(),
  }),
  z.object({ status: z.literal("expired") }),
]);
export type PairStatusResponse = z.infer<typeof PairStatusResponseSchema>;

// --- notify -----------------------------------------------------------------

export const NotifyRequestSchema = z.object({
  reset_at_unix: z.number().int().positive(),
  idempotency_key: z.string().min(1).max(200),
});
export type NotifyRequest = z.infer<typeof NotifyRequestSchema>;

export const NotifyResponseSchema = z.object({
  status: z.enum(["scheduled", "duplicate"]),
});
export type NotifyResponse = z.infer<typeof NotifyResponseSchema>;

// --- test -------------------------------------------------------------------

export const TestResponseSchema = z.object({
  status: z.literal("sent"),
});
export type TestResponse = z.infer<typeof TestResponseSchema>;

// --- unpair -----------------------------------------------------------------

export const UnpairResponseSchema = z.object({
  ok: z.literal(true),
});
export type UnpairResponse = z.infer<typeof UnpairResponseSchema>;

// --- health -----------------------------------------------------------------

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  git_sha: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// --- error envelope ---------------------------------------------------------

/** Consistent error shape for all non-2xx JSON bodies. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    request_id: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

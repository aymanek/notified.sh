import { describe, it, expect } from "vitest";
import {
  DetectedLimitEventSchema,
  messageFor,
  idempotencyKeyFor,
} from "../src/domain.js";

describe("messageFor", () => {
  it("returns the reset message", () => {
    const s = messageFor();
    expect(s).toContain("⏰");
    expect(s).toMatch(/reset/i);
  });
});

describe("idempotencyKeyFor", () => {
  it("is deterministic per reset_at", () => {
    expect(idempotencyKeyFor(1745600000)).toBe("reset:1745600000");
  });

  it("distinguishes resets at different times", () => {
    expect(idempotencyKeyFor(1)).not.toBe(idempotencyKeyFor(2));
  });
});

describe("DetectedLimitEventSchema", () => {
  const valid = {
    reset_at: 1_745_600_000,
    source: "claude_jsonl" as const,
    confidence: "high" as const,
    idempotency_key: "reset:1745600000",
  };

  it("accepts a well-formed event", () => {
    expect(DetectedLimitEventSchema.parse(valid)).toEqual(valid);
  });

  it("rejects negative reset_at", () => {
    expect(() => DetectedLimitEventSchema.parse({ ...valid, reset_at: -1 })).toThrow();
  });

  it("rejects bad source", () => {
    expect(() =>
      DetectedLimitEventSchema.parse({ ...valid, source: "somewhere_else" }),
    ).toThrow();
  });

  it("rejects empty idempotency key", () => {
    expect(() => DetectedLimitEventSchema.parse({ ...valid, idempotency_key: "" })).toThrow();
  });

  it("rejects oversized idempotency key", () => {
    expect(() =>
      DetectedLimitEventSchema.parse({ ...valid, idempotency_key: "x".repeat(500) }),
    ).toThrow();
  });
});

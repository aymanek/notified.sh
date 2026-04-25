import { describe, it, expect } from "vitest";
import {
  LimitKindSchema,
  DetectedLimitEventSchema,
  messageFor,
  idempotencyKeyFor,
} from "../src/domain.js";

describe("LimitKindSchema", () => {
  it("accepts session and weekly", () => {
    expect(LimitKindSchema.parse("session")).toBe("session");
    expect(LimitKindSchema.parse("weekly")).toBe("weekly");
  });

  it("rejects unknown kinds", () => {
    expect(() => LimitKindSchema.parse("monthly")).toThrow();
    expect(() => LimitKindSchema.parse("")).toThrow();
    expect(() => LimitKindSchema.parse(null)).toThrow();
  });
});

describe("messageFor", () => {
  it("returns the reset message for any kind", () => {
    const s = messageFor("session");
    const w = messageFor("weekly");
    expect(s).toBe(w);
    expect(s).toContain("⏰");
    expect(s).toMatch(/reset/i);
  });
});

describe("idempotencyKeyFor", () => {
  it("is deterministic per (kind, reset_at)", () => {
    expect(idempotencyKeyFor("session", 1745600000)).toBe("session:1745600000");
    expect(idempotencyKeyFor("weekly", 1745600000)).toBe("weekly:1745600000");
  });

  it("distinguishes kinds at the same reset", () => {
    expect(idempotencyKeyFor("session", 1)).not.toBe(idempotencyKeyFor("weekly", 1));
  });
});

describe("DetectedLimitEventSchema", () => {
  const valid = {
    limit_kind: "session" as const,
    reset_at: 1_745_600_000,
    source: "claude_jsonl" as const,
    confidence: "high" as const,
    idempotency_key: "session:1745600000",
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

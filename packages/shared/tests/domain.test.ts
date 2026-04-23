import { describe, it, expect } from "vitest";
import {
  LimitKindSchema,
  DetectedLimitEventSchema,
  messageFor,
  idempotencyKeyFor,
  type LimitKind,
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
  it("returns distinct templates per kind", () => {
    const s = messageFor("session");
    const w = messageFor("weekly");
    expect(s).not.toBe(w);
    expect(s).toMatch(/session/i);
    expect(w).toMatch(/weekly/i);
    expect(s).toContain("⏰");
    expect(w).toContain("📅");
  });

  it("has coverage for every LimitKind via exhaustive switch", () => {
    // If a new LimitKind is added, this switch will fail typecheck unless
    // messageFor() is updated, catching the class of bug where a new kind
    // ships without a matching copy string.
    const check = (k: LimitKind): string => {
      switch (k) {
        case "session":
          return messageFor(k);
        case "weekly":
          return messageFor(k);
        default: {
          const _exhaustive: never = k;
          throw new Error(`unhandled LimitKind: ${_exhaustive}`);
        }
      }
    };
    expect(check("session")).toBe(messageFor("session"));
    expect(check("weekly")).toBe(messageFor("weekly"));
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

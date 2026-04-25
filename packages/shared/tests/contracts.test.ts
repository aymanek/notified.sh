import { describe, it, expect } from "vitest";
import {
  PairStartResponseSchema,
  PairStatusResponseSchema,
  NotifyRequestSchema,
  NotifyResponseSchema,
  TestRequestSchema,
  TestResponseSchema,
  UnpairResponseSchema,
  HealthResponseSchema,
  ErrorResponseSchema,
} from "../src/contracts.js";

describe("PairStartResponseSchema", () => {
  const valid = {
    session_id: "abc123",
    deep_link: "https://t.me/newbot/notifiedshbot/notified_x_bot?name=notified.sh",
    qr_data: "some-qr-payload",
    expires_at: 1_745_600_000,
  };

  it("round-trips a valid response", () => {
    expect(PairStartResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects non-URL deep_link", () => {
    expect(() => PairStartResponseSchema.parse({ ...valid, deep_link: "not a url" })).toThrow();
  });

  it("rejects zero/negative expires_at", () => {
    expect(() => PairStartResponseSchema.parse({ ...valid, expires_at: 0 })).toThrow();
    expect(() => PairStartResponseSchema.parse({ ...valid, expires_at: -1 })).toThrow();
  });

  it("rejects empty session_id", () => {
    expect(() => PairStartResponseSchema.parse({ ...valid, session_id: "" })).toThrow();
  });
});

describe("PairStatusResponseSchema", () => {
  it("accepts pending", () => {
    expect(PairStatusResponseSchema.parse({ status: "pending" })).toEqual({ status: "pending" });
  });

  it("accepts awaiting_start with child_bot_username", () => {
    const v = { status: "awaiting_start", child_bot_username: "notified_x_bot" };
    expect(PairStatusResponseSchema.parse(v)).toEqual(v);
  });

  it("accepts complete without device_token", () => {
    const v = { status: "complete", child_bot_username: "notified_x_bot" };
    expect(PairStatusResponseSchema.parse(v)).toEqual(v);
  });

  it("accepts complete with one-time device_token", () => {
    const v = {
      status: "complete",
      child_bot_username: "notified_x_bot",
      device_token: "deadbeef",
    };
    expect(PairStatusResponseSchema.parse(v)).toEqual(v);
  });

  it("accepts expired", () => {
    expect(PairStatusResponseSchema.parse({ status: "expired" })).toEqual({ status: "expired" });
  });

  it("rejects unknown status", () => {
    expect(() => PairStatusResponseSchema.parse({ status: "bogus" })).toThrow();
  });

  it("rejects awaiting_start missing child_bot_username", () => {
    expect(() => PairStatusResponseSchema.parse({ status: "awaiting_start" })).toThrow();
  });
});

describe("NotifyRequestSchema", () => {
  const valid = {
    limit_kind: "session" as const,
    reset_at_unix: 1_745_600_000,
    idempotency_key: "session:1745600000",
  };

  it("round-trips a valid request", () => {
    expect(NotifyRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects unknown limit_kind", () => {
    expect(() => NotifyRequestSchema.parse({ ...valid, limit_kind: "monthly" })).toThrow();
  });

  it("rejects negative or zero reset_at_unix", () => {
    expect(() => NotifyRequestSchema.parse({ ...valid, reset_at_unix: 0 })).toThrow();
    expect(() => NotifyRequestSchema.parse({ ...valid, reset_at_unix: -5 })).toThrow();
  });

  it("rejects non-integer reset_at_unix", () => {
    expect(() => NotifyRequestSchema.parse({ ...valid, reset_at_unix: 1.5 })).toThrow();
  });

  it("rejects empty and oversized idempotency_key", () => {
    expect(() => NotifyRequestSchema.parse({ ...valid, idempotency_key: "" })).toThrow();
    expect(() =>
      NotifyRequestSchema.parse({ ...valid, idempotency_key: "x".repeat(201) }),
    ).toThrow();
  });
});

describe("NotifyResponseSchema", () => {
  it("accepts scheduled and duplicate", () => {
    expect(NotifyResponseSchema.parse({ status: "scheduled" })).toEqual({ status: "scheduled" });
    expect(NotifyResponseSchema.parse({ status: "duplicate" })).toEqual({ status: "duplicate" });
  });

  it("rejects other statuses", () => {
    expect(() => NotifyResponseSchema.parse({ status: "sent" })).toThrow();
  });
});

describe("TestRequestSchema / TestResponseSchema", () => {
  it("round-trips a test request", () => {
    expect(TestRequestSchema.parse({ limit_kind: "session" })).toEqual({ limit_kind: "session" });
  });

  it("rejects any non-session kind", () => {
    expect(() => TestRequestSchema.parse({ limit_kind: "weekly" })).toThrow();
    expect(() => TestRequestSchema.parse({ limit_kind: "daily" })).toThrow();
  });

  it("accepts only sent on response", () => {
    expect(TestResponseSchema.parse({ status: "sent" })).toEqual({ status: "sent" });
    expect(() => TestResponseSchema.parse({ status: "scheduled" })).toThrow();
  });
});

describe("UnpairResponseSchema", () => {
  it("accepts { ok: true }", () => {
    expect(UnpairResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it("rejects { ok: false }", () => {
    expect(() => UnpairResponseSchema.parse({ ok: false })).toThrow();
  });
});

describe("HealthResponseSchema", () => {
  const valid = { ok: true as const, version: "0.1.0", git_sha: "abc1234" };

  it("round-trips", () => {
    expect(HealthResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing fields", () => {
    expect(() => HealthResponseSchema.parse({ ok: true, version: "0.1.0" })).toThrow();
  });
});

describe("ErrorResponseSchema", () => {
  it("accepts a well-formed envelope", () => {
    const v = { error: { code: "bad_request", message: "nope", request_id: "r-1" } };
    expect(ErrorResponseSchema.parse(v)).toEqual(v);
  });

  it("accepts envelope without request_id", () => {
    const v = { error: { code: "bad_request", message: "nope" } };
    expect(ErrorResponseSchema.parse(v)).toEqual(v);
  });

  it("rejects empty code or message", () => {
    expect(() => ErrorResponseSchema.parse({ error: { code: "", message: "x" } })).toThrow();
    expect(() => ErrorResponseSchema.parse({ error: { code: "x", message: "" } })).toThrow();
  });
});

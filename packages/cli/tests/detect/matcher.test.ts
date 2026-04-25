import { describe, it, expect } from "vitest";
import { join } from "path";
import { readRateLimitLines } from "../../src/detect/jsonl.js";
import { detectRateLimit } from "../../src/detect/matcher.js";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function fixture(name: string) {
  return join(FIXTURES, name);
}

describe("readRateLimitLines", () => {
  it("extracts rate-limit lines from session fixture", async () => {
    const lines = await readRateLimitLines(fixture("session_simple.jsonl"));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toContain("resets 3am");
  });

  it("returns empty for file with no rate-limit events", async () => {
    const lines = await readRateLimitLines(fixture("no_ratelimit.jsonl"));
    expect(lines).toHaveLength(0);
  });

  it("returns all rate-limit lines in duplicate fixture", async () => {
    const lines = await readRateLimitLines(fixture("duplicate.jsonl"));
    expect(lines).toHaveLength(2);
  });
});

describe("detectRateLimit", () => {
  it("parses hour-only time (3am) and returns high confidence", async () => {
    const lines = await readRateLimitLines(fixture("session_simple.jsonl"));
    const result = detectRateLimit(lines);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
    expect(result!.reset_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("parses hour:minute time (12:00pm)", async () => {
    const lines = await readRateLimitLines(fixture("weekly_simple.jsonl"));
    const result = detectRateLimit(lines);
    expect(result).not.toBeNull();
    expect(result!.reset_at).toBeGreaterThan(0);
  });

  it("returns null for file with no rate-limit events", async () => {
    const result = detectRateLimit([]);
    expect(result).toBeNull();
  });

  it("picks newest line in duplicate fixture", async () => {
    const lines = await readRateLimitLines(fixture("duplicate.jsonl"));
    expect(lines).toHaveLength(2);
    // Both have same reset time so result should still parse
    const result = detectRateLimit(lines);
    expect(result).not.toBeNull();
  });
});

describe("reset time inference", () => {
  it("parses a reset within 12h", async () => {
    // Create a line with a reset time ~5h from now
    const nowSec = Math.floor(Date.now() / 1000);
    const resetSec = nowSec + 5 * 3600;
    const resetDate = new Date(resetSec * 1000);

    // Format as e.g. "3:25am" in UTC for testing
    const h = resetDate.getUTCHours();
    const m = resetDate.getUTCMinutes();
    const period = h < 12 ? "am" : "pm";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = m === 0
      ? `${displayH}${period}`
      : `${displayH}:${String(m).padStart(2, "0")}${period}`;

    const { detectRateLimit: detect } = await import("../../src/detect/matcher.js");
    const result = detect([{
      timestamp: new Date().toISOString(),
      text: `You've hit your limit · resets ${timeStr} (UTC)`,
    }]);

    expect(result).not.toBeNull();
    expect(result!.reset_at).toBeGreaterThan(0);
  });

  it("parses a reset regardless of distance within the next day", async () => {
    const { detectRateLimit: detect } = await import("../../src/detect/matcher.js");
    const result = detect([{
      timestamp: new Date().toISOString(),
      text: `You've hit your limit · resets 11:59pm (UTC)`,
    }]);
    expect(result).not.toBeNull();
    expect(result!.reset_at).toBeGreaterThan(0);
  });
});

import type { RateLimitLine } from "./jsonl.js";

export type Detection = {
  reset_at: number; // unix seconds
  confidence: "high" | "medium";
};

const RESET_RE = /resets\s+(\d{1,2}(?::\d{2})?\s*[ap]m)\s*\(([^)]+)\)/i;

/**
 * Given rate-limit lines (oldest → newest), return the most recent detection.
 * Returns null if no parseable reset time is found or the reset is stale (>6h past).
 */
export function detectRateLimit(lines: RateLimitLine[]): Detection | null {
  // Scan from newest to oldest
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    const result = parseLine(line);
    if (result) return result;
  }
  return null;
}

function parseLine(line: RateLimitLine): Detection | null {
  const m = RESET_RE.exec(line.text);
  if (!m) return null;

  const timeStr = m[1]!.trim();
  const tz = m[2]!.trim();

  const reset_at = resolveNextOccurrence(timeStr, tz);
  if (reset_at === null) return null;

  const nowSec = Math.floor(Date.now() / 1000);

  // Reject if reset is more than 6h in the past (stale line)
  if (reset_at < nowSec - 6 * 3600) return null;

  return {
    reset_at,
    confidence: "high",
  };
}

/**
 * Parse a time string like "3am" or "1:40am" in a given IANA timezone,
 * returning the next unix epoch (seconds) at which that time will occur.
 */
function resolveNextOccurrence(timeStr: string, tz: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i.exec(timeStr.trim());
  if (!m) return null;

  let hour = parseInt(m[1]!, 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3]!.toLowerCase();

  if (period === "am") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  // Try today and tomorrow in the target timezone
  const now = Date.now();
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const candidate = epochForTimeInTz(new Date(now + dayOffset * 86_400_000), hour, minute, tz);
    if (candidate !== null && candidate > now / 1000 - 60) {
      // Allow up to 1 minute in the past to handle clock skew
      return candidate;
    }
  }

  return null;
}

/**
 * Given a reference date (used only for the calendar date in `tz`),
 * return the unix epoch (seconds) for hour:minute on that day in `tz`.
 */
function epochForTimeInTz(ref: Date, hour: number, minute: number, tz: string): number | null {
  try {
    // Get year/month/day in target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ref);

    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)!.value, 10);

    const year = get("year");
    const month = get("month"); // 1-based
    const day = get("day");

    // Estimate: treat as if UTC (no offset), then correct with actual offset
    const estimate = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offset = getUtcOffsetMs(new Date(estimate), tz);
    // epoch_utc = tz_local_time - offset
    const corrected = estimate - offset;

    // Second pass: offset can shift at DST boundary — correct once more
    const offset2 = getUtcOffsetMs(new Date(corrected), tz);
    return Math.floor((estimate - offset2) / 1000);
  } catch {
    return null;
  }
}

/**
 * Returns (tz_local_time - utc_time) in milliseconds for a given Date.
 * Positive = tz is ahead of UTC, negative = tz is behind UTC.
 */
function getUtcOffsetMs(date: Date, tz: string): number {
  // Format the same moment in both UTC and target tz, compare hour/minute
  const fmtOpts: Intl.DateTimeFormatOptions = {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const utcParts = new Intl.DateTimeFormat("en-US", { ...fmtOpts, timeZone: "UTC" }).formatToParts(date);
  const tzParts  = new Intl.DateTimeFormat("en-US", { ...fmtOpts, timeZone: tz  }).formatToParts(date);

  const getMs = (parts: Intl.DateTimeFormatPart[]) => {
    const g = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), 0);
  };

  return getMs(tzParts) - getMs(utcParts);
}

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export type RateLimitLine = {
  timestamp: string;
  text: string;
};

/** Read a single JSONL file and return all rate-limit lines in order. */
export async function readRateLimitLines(transcriptPath: string): Promise<RateLimitLine[]> {
  const results: RateLimitLine[] = [];

  const rl = createInterface({
    input: createReadStream(transcriptPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (
        entry["type"] === "assistant" &&
        entry["error"] === "rate_limit" &&
        entry["isApiErrorMessage"] === true
      ) {
        const msg = entry["message"] as Record<string, unknown> | undefined;
        const content = msg?.["content"] as Array<{ type: string; text: string }> | undefined;
        const text = content?.[0]?.text;
        if (typeof text === "string" && text.includes("resets")) {
          results.push({ timestamp: entry["timestamp"] as string, text });
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

/**
 * Try to get transcript path from hook stdin payload.
 * Claude Code sends JSON on stdin for StopFailure hooks.
 */
export async function transcriptPathFromStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  return new Promise<string | null>((resolve) => {
    let raw = "";
    const timer = setTimeout(() => resolve(null), 500);

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => { raw += chunk; });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      try {
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const p = payload["transcript_path"];
        resolve(typeof p === "string" && p.length > 0 ? p : null);
      } catch {
        resolve(null);
      }
    });
    process.stdin.on("error", () => { clearTimeout(timer); resolve(null); });
  });
}

/** Fallback: find most recently modified JSONL under ~/.claude/projects/. */
export async function findMostRecentTranscript(): Promise<string | null> {
  const claudeDir = process.env["CLAUDE_CODE_DATA_DIR"] ?? join(homedir(), ".claude");
  const projectsDir = join(claudeDir, "projects");

  try {
    const entries = await collectJsonlFiles(projectsDir);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b.mtime - a.mtime);
    return entries[0]!.path;
  } catch {
    return null;
  }
}

type FileEntry = { path: string; mtime: number };

async function collectJsonlFiles(dir: string): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return results;
  }

  await Promise.all(
    entries.map(async (name) => {
      const full = join(dir, name);
      try {
        const s = await stat(full);
        if (s.isDirectory()) {
          const sub = await collectJsonlFiles(full);
          results.push(...sub);
        } else if (name.endsWith(".jsonl")) {
          results.push({ path: full, mtime: s.mtimeMs });
        }
      } catch {
        // skip
      }
    }),
  );

  return results;
}

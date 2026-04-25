import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { isInstalled, installHook, uninstallHook } from "../../src/hook/install.js";

const TEST_CMD = "/usr/bin/node /path/to/cli.js _hook stop";

describe("isInstalled", () => {
  it("returns false for empty settings", () => {
    expect(isInstalled({})).toBe(false);
  });

  it("returns false when hooks is not an object", () => {
    expect(isInstalled({ hooks: [] as unknown as Record<string, never[]> })).toBe(false);
  });

  it("returns false when StopFailure key missing", () => {
    expect(isInstalled({
      hooks: {
        PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "other" }] }],
      },
    })).toBe(false);
  });

  it("returns false when our signature not in any command", () => {
    expect(isInstalled({
      hooks: {
        StopFailure: [{ matcher: "rate_limit", hooks: [{ type: "command", command: "other cmd" }] }],
      },
    })).toBe(false);
  });

  it("returns true for absolute-path command containing _hook stop", () => {
    expect(isInstalled({
      hooks: {
        StopFailure: [{ matcher: "rate_limit", hooks: [{ type: "command", command: TEST_CMD }] }],
      },
    })).toBe(true);
  });

  it("returns true for legacy 'notified _hook stop' command", () => {
    expect(isInstalled({
      hooks: {
        StopFailure: [{ matcher: "rate_limit", hooks: [{ type: "command", command: "notified _hook stop" }] }],
      },
    })).toBe(true);
  });
});

describe("installHook / uninstallHook (file-based)", () => {
  let tmpDir: string;
  let origEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `notified-hook-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    origEnv = process.env["CLAUDE_CODE_DATA_DIR"];
    process.env["CLAUDE_CODE_DATA_DIR"] = tmpDir;
  });

  afterEach(async () => {
    if (origEnv === undefined) {
      delete process.env["CLAUDE_CODE_DATA_DIR"];
    } else {
      process.env["CLAUDE_CODE_DATA_DIR"] = origEnv;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates settings.json with StopFailure hook when file is missing", async () => {
    await installHook(TEST_CMD);
    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as { hooks: { StopFailure: unknown } };
    expect(settings.hooks).toBeDefined();
    expect(Array.isArray(settings.hooks.StopFailure)).toBe(true);
    expect(JSON.stringify(settings)).toContain("_hook stop");
    expect(JSON.stringify(settings)).toContain(TEST_CMD);
  });

  it("is idempotent — second install does not duplicate", async () => {
    await installHook(TEST_CMD);
    await installHook(TEST_CMD);
    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as {
      hooks: { StopFailure: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = settings.hooks.StopFailure.flatMap((b) => b.hooks.map((h) => h.command));
    expect(commands.filter((c) => c.includes("_hook stop"))).toHaveLength(1);
  });

  it("merges with existing hooks without destroying them", async () => {
    const existing = {
      hooks: {
        PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo pre" }] }],
      },
    };
    await writeFile(join(tmpDir, "settings.json"), JSON.stringify(existing));
    await installHook(TEST_CMD);
    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as { hooks: Record<string, unknown> };
    expect(settings.hooks["PreToolUse"]).toBeDefined();
    expect(JSON.stringify(settings.hooks["StopFailure"])).toContain("_hook stop");
  });

  it("uninstall removes only our command and leaves other hooks", async () => {
    const initial = {
      hooks: {
        PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo pre" }] }],
        StopFailure: [
          {
            matcher: "rate_limit",
            hooks: [
              { type: "command", command: TEST_CMD, timeout: 5 },
              { type: "command", command: "other hook" },
            ],
          },
        ],
      },
    };
    await writeFile(join(tmpDir, "settings.json"), JSON.stringify(initial));
    await uninstallHook();
    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as {
      hooks: {
        PreToolUse: unknown;
        StopFailure?: Array<{ hooks: Array<{ command: string }> }>;
      };
    };
    expect(settings.hooks.PreToolUse).toBeDefined();
    const cmds = settings.hooks.StopFailure?.flatMap((b) => b.hooks.map((h) => h.command)) ?? [];
    expect(cmds).not.toContain(TEST_CMD);
    expect(cmds).toContain("other hook");
  });

  it("uninstall removes empty StopFailure block entirely", async () => {
    await installHook(TEST_CMD);
    await uninstallHook();
    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as { hooks: Record<string, unknown> };
    expect(settings.hooks["StopFailure"]).toBeUndefined();
  });

  it("replaces legacy 'notified _hook stop' on upgrade", async () => {
    const legacy = {
      hooks: {
        StopFailure: [
          {
            matcher: "rate_limit",
            hooks: [{ type: "command", command: "notified _hook stop", timeout: 5 }],
          },
        ],
      },
    };
    await writeFile(join(tmpDir, "settings.json"), JSON.stringify(legacy));
    await installHook(TEST_CMD);

    const raw = await readFile(join(tmpDir, "settings.json"), "utf8");
    const settings = JSON.parse(raw) as {
      hooks: { StopFailure: Array<{ hooks: Array<{ command: string }> }> };
    };
    const cmds = settings.hooks.StopFailure.flatMap((b) => b.hooks.map((h) => h.command));
    expect(cmds).toContain(TEST_CMD);
    expect(cmds).not.toContain("notified _hook stop");
  });
});

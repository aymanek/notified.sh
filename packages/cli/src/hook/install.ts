import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { claudeDataDir } from "../paths.js";

const HOOK_SIGNATURE = "_hook stop"; // substring used to identify our hook entries
const HOOK_EVENT = "StopFailure";
const HOOK_MATCHER = "rate_limit";
const SETTINGS_FILE = () => join(claudeDataDir(), "settings.json");

type HookEntry = { type: string; command: string; timeout?: number };
type HookBlock = { matcher: string; hooks: HookEntry[] };
type Settings = { hooks?: Record<string, HookBlock[]> };

export async function installHook(command: string): Promise<void> {
  const path = SETTINGS_FILE();

  let settings: Settings = {};
  let raw: string | null = null;

  try {
    raw = await readFile(path, "utf8");
    settings = JSON.parse(raw) as Settings;
  } catch {
    // File missing → we'll create it
  }

  if (raw !== null) {
    if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
      throw new Error(`${path} has unexpected format. Please fix it manually and retry.`);
    }
    await copyFile(path, `${path}.bak`);
  }

  // Idempotent: bail only if the EXACT command is already installed.
  if (hasExactCommand(settings, command)) return;

  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) {
    settings.hooks = {};
  }

  // Strip any legacy/stale _hook stop entries first — handles upgrades from
  // the old PATH-dependent `notified _hook stop` form.
  removeOurEntries(settings);

  const eventBlocks = settings.hooks[HOOK_EVENT] ?? [];
  const existing = eventBlocks.find(
    (b) => b.matcher === HOOK_MATCHER && Array.isArray(b.hooks),
  );

  const entry: HookEntry = { type: "command", command, timeout: 5 };

  if (existing) {
    existing.hooks.push(entry);
  } else {
    eventBlocks.push({ matcher: HOOK_MATCHER, hooks: [entry] });
  }

  settings.hooks[HOOK_EVENT] = eventBlocks;

  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(settings, null, 2), { mode: 0o600 });
  const { rename } = await import("fs/promises");
  await rename(tmp, path);
}

export async function uninstallHook(): Promise<void> {
  const path = SETTINGS_FILE();
  let settings: Settings;

  try {
    settings = JSON.parse(await readFile(path, "utf8")) as Settings;
  } catch {
    return;
  }

  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) return;

  const eventBlocks = settings.hooks[HOOK_EVENT];
  if (!Array.isArray(eventBlocks)) return;

  let changed = false;
  for (const block of eventBlocks) {
    if (!Array.isArray(block.hooks)) continue;
    const before = block.hooks.length;
    block.hooks = block.hooks.filter((h) => !h.command.includes(HOOK_SIGNATURE));
    if (block.hooks.length !== before) changed = true;
  }

  settings.hooks[HOOK_EVENT] = eventBlocks.filter(
    (b) => Array.isArray(b.hooks) && b.hooks.length > 0,
  );
  if (settings.hooks[HOOK_EVENT]!.length === 0) {
    delete settings.hooks[HOOK_EVENT];
  }

  if (!changed) return;

  await writeFile(path, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

export function isInstalled(settings: Settings): boolean {
  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) return false;
  const eventBlocks = settings.hooks[HOOK_EVENT];
  if (!Array.isArray(eventBlocks)) return false;
  return eventBlocks.some(
    (block) =>
      Array.isArray(block.hooks) &&
      block.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_SIGNATURE)),
  );
}

function hasExactCommand(settings: Settings, command: string): boolean {
  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) return false;
  const eventBlocks = settings.hooks[HOOK_EVENT];
  if (!Array.isArray(eventBlocks)) return false;
  return eventBlocks.some(
    (block) =>
      Array.isArray(block.hooks) && block.hooks.some((h) => h.command === command),
  );
}

function removeOurEntries(settings: Settings): void {
  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) return;
  const eventBlocks = settings.hooks[HOOK_EVENT];
  if (!Array.isArray(eventBlocks)) return;

  for (const block of eventBlocks) {
    if (!Array.isArray(block.hooks)) continue;
    block.hooks = block.hooks.filter((h) => !h.command.includes(HOOK_SIGNATURE));
  }
  settings.hooks[HOOK_EVENT] = eventBlocks.filter(
    (b) => Array.isArray(b.hooks) && b.hooks.length > 0,
  );
  if (settings.hooks[HOOK_EVENT]!.length === 0) {
    delete settings.hooks[HOOK_EVENT];
  }
}

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { CONFIG_FILE } from "./paths.js";

export type Config = {
  api_base: string;
  device_token: string;
  child_bot_username: string;
  paired_at: number;
};

export async function loadConfig(): Promise<Config | null> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(dirname(CONFIG_FILE), { recursive: true });
  const json = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_FILE, json, { mode: 0o600, flag: "w" });
}

export async function deleteConfig(): Promise<void> {
  const { unlink } = await import("fs/promises");
  try {
    await unlink(CONFIG_FILE);
  } catch {
    // Ignore if already gone
  }
}

export function resolvedApiBase(config: Config | null): string {
  return process.env["NOTIFIED_API"] ?? config?.api_base ?? "https://api.notified.sh";
}

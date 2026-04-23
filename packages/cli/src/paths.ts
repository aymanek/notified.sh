import { homedir } from "os";
import { join } from "path";

export function configDir(): string {
  if (process.platform === "win32") {
    const appdata = process.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming");
    return join(appdata, "notified");
  }
  const xdg = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");
  return join(xdg, "notified");
}

export const CONFIG_FILE = join(configDir(), "config.json");
export const STATE_FILE = join(configDir(), "state.json");

/** Directory where Claude Code stores session JSONL files. */
export function claudeDataDir(): string {
  return process.env["CLAUDE_CODE_DATA_DIR"] ?? join(homedir(), ".claude");
}

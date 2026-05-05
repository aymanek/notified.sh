import { readFile } from "fs/promises";
import { join } from "path";
import { loadConfig, resolvedApiBase } from "../config.js";
import { HealthResponseSchema, type HealthResponse } from "@notified.sh/shared";
import { get } from "../api-client.js";
import { claudeDataDir } from "../paths.js";
import { PKG_VERSION } from "../version.js";

export async function runStatus(): Promise<void> {
  const config = await loadConfig();
  const apiBase = resolvedApiBase(config);

  console.log(`Plugin v:  ${PKG_VERSION}`);

  if (!config) {
    console.log("Status:    not paired");
    console.log("           Run `notified pair` to get started.");
  } else {
    const pairedAt = new Date(config.paired_at * 1000).toLocaleString();
    console.log(`Status:    paired`);
    console.log(`Bot:       @${config.child_bot_username}`);
    console.log(`Paired:    ${pairedAt}`);
  }

  console.log(`API:       ${apiBase}`);

  const hookInstalled = await checkHookInstalled();
  console.log(`Hook:      ${hookInstalled ? "installed" : "not installed"}`);

  try {
    const health = await get<HealthResponse>(HealthResponseSchema, `${apiBase}/health`, undefined, 3_000);
    console.log(`API v:     ${health.version} (${health.git_sha})`);
    console.log(`Reachable: yes`);
  } catch {
    console.log(`Reachable: no`);
  }
}

async function checkHookInstalled(): Promise<boolean> {
  try {
    const settingsPath = join(claudeDataDir(), "settings.json");
    const raw = await readFile(settingsPath, "utf8");
    const settings = JSON.parse(raw) as Record<string, unknown>;
    // hooks is an object keyed by event type: { StopFailure: [{ matcher, hooks }] }
    const hooks = settings["hooks"] as Record<string, Array<{ hooks?: Array<{ command?: string }> }>> | undefined;
    if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) return false;
    const blocks = hooks["StopFailure"];
    if (!Array.isArray(blocks)) return false;
    return blocks.some((block) =>
      Array.isArray(block.hooks) &&
      block.hooks.some((h) => typeof h.command === "string" && h.command.includes("_hook stop")),
    );
  } catch {
    return false;
  }
}

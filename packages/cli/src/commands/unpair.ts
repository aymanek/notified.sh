import { UnpairResponseSchema } from "@notified.sh/shared";
import { post } from "../api-client.js";
import { loadConfig, deleteConfig, resolvedApiBase } from "../config.js";
import { deleteState } from "../state.js";
import { uninstallHook } from "../hook/install.js";

export async function runUnpair(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.log("Not paired — nothing to do.");
    return;
  }

  const apiBase = resolvedApiBase(config);

  try {
    await post(UnpairResponseSchema, `${apiBase}/v1/unpair`, undefined, config.device_token);
  } catch (err: unknown) {
    // Log but continue — local cleanup should always succeed
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: server-side unpair failed (${msg}). Cleaning up locally anyway.`);
  }

  await uninstallHook();
  await deleteConfig();
  await deleteState();

  console.log("Unpaired. Hook removed. Local config deleted.");
}

import { TestResponseSchema } from "@notified.sh/shared";
import { post } from "../api-client.js";
import { loadConfig, resolvedApiBase } from "../config.js";

export async function runTest(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not paired. Run `notified pair` first.");
    process.exit(1);
  }

  const apiBase = resolvedApiBase(config);
  await post(
    TestResponseSchema,
    `${apiBase}/v1/test`,
    undefined,
    config.device_token,
  );

  console.log(`Sent! Check your Telegram DM from @${config.child_bot_username}.`);
}

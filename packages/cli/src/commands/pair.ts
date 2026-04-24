import * as qrcode from "qrcode-terminal";
import {
  PairStartResponseSchema,
  PairStatusResponseSchema,
} from "@notified.sh/shared";
import { get, post } from "../api-client.js";
import { saveConfig, resolvedApiBase } from "../config.js";
import { installHook } from "../hook/install.js";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000; // 10 min

export async function runPair(): Promise<void> {
  const apiBase = resolvedApiBase(null);

  // 1. Start pairing session
  const session = await post(PairStartResponseSchema, `${apiBase}/v1/pair`);

  // 2. Show QR + deep link
  console.log("\nScan the QR code or open the link in Telegram:\n");
  qrcode.generate(session.deep_link, { small: true });
  console.log(`\n  ${session.deep_link}\n`);
  console.log("Waiting for you to start the bot in Telegram...");

  // 3. Poll for completion
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = "pending";

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const status = await get(
      PairStatusResponseSchema,
      `${apiBase}/v1/pair/${session.session_id}`,
    );

    if (status.status === "expired") {
      console.error("\nSession expired. Run `notified pair` again.");
      process.exit(1);
    }

    if (status.status === "awaiting_start" && lastStatus !== "awaiting_start") {
      console.log(`\nBot @${status.child_bot_username} created — send /start to it in Telegram.`);
      lastStatus = "awaiting_start";
    }

    if (status.status === "complete") {
      if (!status.device_token) {
        // Token already consumed by a previous poll (shouldn't happen in practice)
        console.error("\nPairing complete but device token was already consumed. Run `notified pair` again.");
        process.exit(1);
      }

      await saveConfig({
        api_base: apiBase,
        device_token: status.device_token,
        child_bot_username: status.child_bot_username,
        paired_at: Math.floor(Date.now() / 1000),
      });

      await installHook();

      console.log(`\nPaired with @${status.child_bot_username}`);
      console.log("Hook installed. You'll get a Telegram message at each limit reset.");
      return;
    }
  }

  console.error("\nTimed out waiting for pairing. Run `notified pair` again.");
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

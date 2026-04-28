import qrcode from "qrcode-terminal";
import {
  PairStartResponseSchema,
  PairStatusResponseSchema,
  type PairStartResponse,
} from "@notified.sh/shared";
import { get, post } from "../api-client.js";
import { saveConfig, resolvedApiBase } from "../config.js";
import { installHook } from "../hook/install.js";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000; // 10 min

/**
 * Default interactive flow: start session, print link + QR, poll, save config.
 */
export async function runPair(): Promise<void> {
  const apiBase = resolvedApiBase(null);
  const session = await startSession(apiBase);

  console.log("\nOpen this link in Telegram:\n");
  console.log(`  ${session.deep_link}\n`);
  console.log("If on a different device, scan:");
  qrcode.generate(session.deep_link, { small: true });
  console.log("\nWaiting for you to start the bot in Telegram...");

  await pollAndPersist(apiBase, session.session_id);
}

/**
 * Machine-readable mode for the plugin nudge flow.
 *
 * Starts a pairing session and prints a single JSON line with everything
 * Claude needs to render the pairing UI in its own response (deep link +
 * pre-rendered QR ASCII), then exits without polling. The caller is
 * expected to follow up with `pair --wait <session_id>` to drive the
 * polling loop separately.
 *
 * Splitting display from polling keeps the QR/link in Claude's main answer
 * (full width, readable) instead of a collapsed Bash tool-output box.
 */
export async function runPairJson(): Promise<void> {
  const apiBase = resolvedApiBase(null);
  const session = await startSession(apiBase);
  const qrAscii = await renderQr(session.deep_link);

  process.stdout.write(
    JSON.stringify({
      session_id: session.session_id,
      deep_link: session.deep_link,
      qr_ascii: qrAscii,
    }) + "\n",
  );
}

/**
 * Polling-only mode for the plugin nudge flow.
 *
 * Resumes an existing pairing session created by `pair --json`, polls until
 * the user completes /start in Telegram, and persists config + installs the
 * Stop hook. No display output other than completion status.
 */
export async function runPairWait(sessionId: string): Promise<void> {
  if (!sessionId) {
    console.error("pair --wait requires a session id");
    process.exit(1);
  }
  const apiBase = resolvedApiBase(null);
  await pollAndPersist(apiBase, sessionId);
}

async function startSession(apiBase: string): Promise<PairStartResponse> {
  return post(PairStartResponseSchema, `${apiBase}/v1/pair`);
}

function renderQr(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (out) => resolve(out));
  });
}

async function pollAndPersist(apiBase: string, sessionId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = "pending";

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const status = await get(
      PairStatusResponseSchema,
      `${apiBase}/v1/pair/${sessionId}`,
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
        console.error("\nPairing complete but device token was already consumed. Run `notified pair` again.");
        process.exit(1);
      }

      await saveConfig({
        api_base: apiBase,
        device_token: status.device_token,
        child_bot_username: status.child_bot_username,
        paired_at: Math.floor(Date.now() / 1000),
      });

      const { resolve } = await import("path");
      const nodePath = process.execPath;
      const scriptPath = resolve(process.argv[1] ?? "");
      const hookCommand = `"${nodePath}" "${scriptPath}" _hook stop`;
      await installHook(hookCommand);

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

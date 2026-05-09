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
 * Plugin-flow display step.
 *
 * Starts a pairing session, then prints a fully-formatted markdown reply to
 * stdout that Claude can paste verbatim into its response. The session id
 * is written to stderr so the caller can capture it for the follow-up
 * `pair --wait <id>` call.
 *
 * Why split display from polling: Claude Code desktop collapses the Bash
 * tool-output box to its last line, so a QR rendered there is unreadable.
 * Putting the QR in Claude's reply (markdown fenced block, full width)
 * makes it scannable.
 */
export async function runPairMessage(): Promise<void> {
  const apiBase = resolvedApiBase(null);
  const session = await startSession(apiBase);

  // QR codes only render correctly in terminal-based Claude Code (CLAUDE_CODE_ENTRYPOINT=cli).
  // Other entrypoints (desktop app, web) use HTML/CSS code blocks that add line-height
  // padding, leaving vertical gaps between block characters that make the QR unscannable.
  // The deep link is clickable everywhere, so it's the reliable primary path.
  const isCli = process.env["CLAUDE_CODE_ENTRYPOINT"] === "cli";
  let qrSection: string;
  if (isCli) {
    const qr = await captureQr(session.deep_link);
    qrSection =
      `_Scan the QR with your phone — if it doesn't render cleanly, use the link below instead._\n\n` +
      "```\n" + qr + "\n```\n\n";
  } else {
    qrSection = `To scan from another device, run \`notified pair\` in your terminal.\n\n`;
  }

  const message =
    `**Pair with Telegram to get a ping the moment your Claude rate limit resets** — so you know exactly when you can resume.\n\n` +
    qrSection +
    `[Open in Telegram](${session.deep_link})\n\n` +
    `Send \`/start\` to the bot Telegram opens. Pairing finishes automatically.`;

  process.stdout.write(message + "\n");
  // session id goes to stderr so callers can capture it independently of the
  // markdown body on stdout.
  process.stderr.write(session.session_id + "\n");
}

/**
 * Polling-only mode for the plugin nudge flow.
 *
 * Resumes an existing pairing session created by `pair --message`, polls
 * until the user completes /start in Telegram, and persists config + installs
 * the Stop hook. No display output other than completion status.
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

function captureQr(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, resolve);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

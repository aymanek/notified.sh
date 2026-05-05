import { Command } from "commander";
import { runStatus } from "./commands/status.js";
import { runPair, runPairMessage, runPairWait } from "./commands/pair.js";
import { runTest } from "./commands/test.js";
import { runUnpair } from "./commands/unpair.js";
import { runHookStop } from "./commands/_hookStop.js";
import { runHookCheckPaired } from "./commands/_hookCheckPaired.js";
import { redact } from "./redact.js";

const PKG_VERSION = "0.1.5";

const program = new Command("notified")
  .version(PKG_VERSION, "-v, --version")
  .option("--debug", "Show debug output and stack traces")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts() as { debug?: boolean };
    if (opts.debug || process.env["NOTIFIED_DEBUG"]) {
      process.env["NOTIFIED_DEBUG"] = "1";
    }
  });

// notified status
program
  .command("status")
  .description("Show paired state, hook install status, and API reachability")
  .action(wrapCommand(runStatus));

// notified pair [--message | --wait <session_id>]
program
  .command("pair")
  .description("Pair with Telegram to receive limit-reset notifications")
  .option("--message", "Start a session and print a markdown-formatted reply on stdout (session id on stderr); no polling")
  .option("--wait <session_id>", "Poll an existing session until complete; no display")
  .action(async (opts: { message?: boolean; wait?: string }) => {
    void checkForUpdate();
    try {
      if (opts.wait) {
        await runPairWait(opts.wait);
      } else if (opts.message) {
        await runPairMessage();
      } else {
        await runPair();
      }
    } catch (err: unknown) {
      handleFatalError(err);
    }
  });

// notified test
program
  .command("test")
  .description("Send a test notification via Telegram")
  .action(async () => {
    void checkForUpdate();
    try {
      await runTest();
    } catch (err: unknown) {
      handleFatalError(err);
    }
  });

// notified unpair
program
  .command("unpair")
  .description("Remove pairing, uninstall hook, delete local config")
  .action(wrapCommand(runUnpair));

// notified _hook <subcommand>  (hidden — called by Claude Code plugin hooks)
program
  .command("_hook <subcommand>", { hidden: true })
  .description("Internal: called by Claude Code plugin hooks")
  .action(async (subcommand: string) => {
    try {
      switch (subcommand) {
        case "stop":
          await runHookStop();
          break;
        case "check-paired":
          await runHookCheckPaired();
          break;
        default:
          // Unknown subcommand — silent exit, never block Claude Code
          break;
      }
    } catch {
      // Never surface errors — must not block Claude Code
    }
    process.exit(0);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  handleFatalError(err);
});

function wrapCommand(fn: () => Promise<void>) {
  return async () => {
    // Simple update check: fire-and-forget, 1s timeout, errors swallowed.
    void checkForUpdate();
    try {
      await fn();
    } catch (err: unknown) {
      handleFatalError(err);
    }
  };
}

function handleFatalError(err: unknown): never {
  const debug = !!process.env["NOTIFIED_DEBUG"];
  if (err instanceof Error) {
    console.error(`Error: ${redact(err.message)}`);
    if (debug) console.error(redact(err.stack ?? ""));
  } else {
    console.error(`Error: ${redact(String(err))}`);
  }
  if (!debug) console.error("Tip: rerun with --debug for details.");
  process.exit(1);
}

async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch("https://registry.npmjs.org/notified.sh/latest", {
      signal: AbortSignal.timeout(1_000),
    });
    const { version } = (await res.json()) as { version: string };
    if (version && version !== PKG_VERSION) {
      console.error(`\nUpdate available: ${PKG_VERSION} → ${version}`);
      console.error("Run: npm install -g notified.sh\n");
    }
  } catch {
    // Swallow — non-critical
  }
}

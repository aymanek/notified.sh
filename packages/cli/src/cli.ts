import { Command } from "commander";
import { runStatus } from "./commands/status.js";
import { redact } from "./redact.js";

const PKG_VERSION = "0.1.0";

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

// M7: pair, test, unpair
// M8: _hook stop (hidden)

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

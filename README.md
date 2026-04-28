# notified.sh

Telegram notifications for Claude Code rate-limit resets. Notifications are scheduled server-side and fire at the exact reset moment — even if your CLI is closed or your laptop is asleep.

## Install

The fastest way is the Claude Code plugin. It auto-installs the hook, registers slash commands, and walks you through Telegram pairing on first run.

```bash
claude plugin marketplace add aymanek/notified.sh
claude plugin install notified@notified
```

On your next Claude Code session it will detect that you're not paired yet and prompt you to scan a QR / open a Telegram link. Send `/start` to the bot it creates and you're done.

### Standalone CLI

If you'd rather skip the plugin, install the CLI globally and pair manually:

```bash
npm install -g notified.sh
notified pair       # opens Telegram link + QR; sends /start to the bot
notified test       # confirm delivery
```

## Slash commands

Once the plugin is installed:

- `/notified` — overview + current status
- `/notified:pair` — pair this machine with Telegram
- `/notified:status` — show pairing, API reachability, and hook install state
- `/notified:test` — send a test notification
- `/notified:unpair` — remove pairing, uninstall hook, delete local config

## How it works

1. A small hook installed in your Claude Code settings watches for rate-limit events at session end.
2. When one fires, the CLI parses the reset time from the session transcript and POSTs a scheduled notification to `api.notified.sh`.
3. The server holds the schedule and dispatches a Telegram message at the reset moment — independent of your machine being on.

No background daemon, no polling, no open browser tab.

## Privacy

- No telemetry from the CLI or plugin.
- The server stores: a hashed device token, an encrypted Telegram bot token per user, and pending notification rows.
- The server does **not** log: Telegram chat IDs, message content, or plaintext tokens.
- See [SECURITY.md](./SECURITY.md) for the threat model.

## Self-host

Self-host instructions for running your own `api.notified.sh` are tracked in [`docs/self-host.mdx`](./docs/self-host.mdx) (coming soon). The server is a single Cloudflare Worker; full source is in [`packages/api`](./packages/api).

## Contributing

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Issues and PRs welcome at <https://github.com/aymanek/notified.sh>.

## License

MIT — see [LICENSE](./LICENSE).

# @notified.sh/plugin

Claude Code plugin for [notified.sh](https://notified.sh) — Telegram notifications for Claude Code rate-limit resets.

## Install

```bash
claude plugin marketplace add aymanek/notified.sh
claude plugin install notified@notified
```

That's it. On the next session, the plugin will detect that you're not paired yet and proactively offer to set up Telegram pairing.

## What it does

- **Auto-installs the hook** that detects rate-limit events at session end
- **Detects rate-limit reset times** from Claude Code's session JSONL transcripts
- **Sends notifications via Telegram** scheduled server-side at the exact reset moment, so they fire even if your CLI or laptop is off

## Slash commands

- `/notified:pair` — pair with Telegram (also runs automatically on first session if unpaired)
- `/notified:status` — show pairing + API reachability
- `/notified:test` — send a test notification
- `/notified:unpair` — remove pairing, clean up hook + local state

## Privacy

- No telemetry on the CLI or runtime
- Server stores: hashed device token, encrypted Telegram bot token, scheduled notification rows
- Server never logs: Telegram chat IDs, message content, plaintext tokens
- See [SECURITY.md](https://github.com/aymanek/notified.sh/blob/main/SECURITY.md)

## Self-host

Phase 2 milestone. Run your own `api.notified.sh` clone — see `docs/self-host.mdx` (coming soon) on the main repo.

---
description: Pair this machine with Telegram for rate-limit notifications
---

Pair the user with Telegram in two steps. The split keeps the QR + link readable in your reply (full width, monospace) instead of getting truncated inside the Bash tool-output box.

**Step 1 — render the pairing message in your reply.** Run:

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" pair --message
```

- stdout is a fully-formatted markdown message (intro + Telegram link + QR fenced block). Paste it **verbatim** into your reply — do not summarize or reformat. The fenced code block around the QR is intentional so it renders monospace.
- stderr is the session id (single line). Capture it for step 2.

**Step 2 — wait for the user to send /start in Telegram.** Run:

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" pair --wait <session_id>
```

This polls for ~10 minutes with no extra display. Do not abort early. When it exits successfully, confirm pairing is done in a brief follow-up message.

Do **not** call `pair` without `--message` / `--wait` — that mode prints the QR into the Bash tool output where it renders poorly.

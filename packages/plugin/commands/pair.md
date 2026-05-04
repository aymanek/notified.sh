---
description: Pair this machine with Telegram for rate-limit notifications
---

Pair the user with Telegram in two steps. The split keeps the QR + link readable in your reply (full width, monospace) instead of getting truncated inside the Bash tool-output box.

**Step 1 — start a session and capture the JSON:**

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" pair --json
```

Stdout is one line of JSON: `{"session_id": "...", "deep_link": "https://t.me/...", "qr_ascii": "...multi-line QR..."}`.

**Step 2 — render the pairing UI in your reply.** Lead with a short friendly sentence ("Here's how to pair notified.sh with Telegram so you get a ping when Claude Code hits a rate limit."). Then:

- Render the deep link as a clickable markdown link, e.g. `[Open in Telegram](<deep_link>)`.
- Put `qr_ascii` inside a fenced code block so it renders monospace.
- Add a one-line note that the QR is for scanning from a different device.

Do **not** paste the JSON itself or call `pair` without `--json` — that mode prints the QR into the Bash tool output where it renders poorly.

**Step 3 — poll until the user completes /start in Telegram:**

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" pair --wait <session_id>
```

This polls for ~10 minutes with no extra display. Wait for it to finish; do not abort early. When it succeeds, confirm pairing is done in a brief follow-up message.

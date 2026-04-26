---
description: Pair this machine with Telegram for rate-limit notifications
---

Run this Bash command for the user:

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" pair
```

This prints a Telegram deep link (clickable in most terminals) plus a QR code as fallback. The user clicks the link or scans the QR, then sends `/start` to the bot in Telegram. The command polls for ~30s while the user completes the action, then saves the pairing.

Wait for the command to finish. Do not abort early. Report success or failure at the end.

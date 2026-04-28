---
description: Overview of the notified.sh plugin — pair, status, test, unpair
---

Run this Bash command for the user to show current state:

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" status
```

Then summarize the output and list the available subcommands so the user can pick a next action:

- `/notified:pair` — pair this machine with Telegram (only needed if status shows "not paired")
- `/notified:status` — show pairing + API + hook install status
- `/notified:test` — send a test Telegram notification to confirm delivery works
- `/notified:unpair` — remove pairing, uninstall hook, delete local config

Keep the reply brief: one line of state + the list. Do not run any of the subcommands here — the user picks.

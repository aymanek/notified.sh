---
description: Remove pairing, uninstall hook, delete local config
---

Run this Bash command for the user:

```
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.cjs" unpair
```

This removes the pairing on the server, uninstalls the hook from the user's settings, and deletes local config + state. After running, the user can re-pair with `/notified:pair` if they wish.

# notified.sh

Claude Code limit notifications via Telegram. Server-side scheduled delivery — notifications fire at the reset moment even if your CLI or laptop is off.

> **Phase 1 scaffold.** Private production build for personal use. OSS polish (LICENSE, CONTRIBUTING, direct/self-host mode, public docs) arrives in Phase 2.

## Status

Milestone 1 complete: monorepo scaffold. `packages/{shared,api,cli}` build and lint green. Real functionality lands in later milestones per [plans/tranquil-drifting-glade.md](../.claude/plans/tranquil-drifting-glade.md).

## Quickstart (coming in Milestone 10)

```bash
npm install -g notified.sh
notified pair      # QR → Telegram → done
notified test --kind session
```

## Dev

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

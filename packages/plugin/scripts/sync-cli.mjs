#!/usr/bin/env node
// Copies the bundled CLI artifact from packages/cli into packages/plugin/dist/.
// Run after `pnpm --filter notified.sh build`.

import { copyFile, mkdir, stat } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = dirname(here);
const monorepoRoot = join(pluginRoot, "..", "..");

const src = join(monorepoRoot, "packages", "cli", "dist", "cli.cjs");
const dst = join(pluginRoot, "dist", "cli.cjs");

try {
  await stat(src);
} catch {
  console.error(`✗ Source not found: ${src}`);
  console.error("  Run `pnpm --filter notified.sh build` first.");
  process.exit(1);
}

await mkdir(dirname(dst), { recursive: true });
await copyFile(src, dst);

const { size } = await stat(dst);
console.log(`✓ Synced cli.cjs → packages/plugin/dist/cli.cjs (${(size / 1024).toFixed(1)} KB)`);

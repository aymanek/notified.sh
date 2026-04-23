import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  outExtension: () => ({ js: ".js" }),
  clean: true,
  // Inline the workspace shared package; keep npm deps external.
  noExternal: [/@notified\.sh\//],
  banner: { js: "#!/usr/bin/env node" },
});

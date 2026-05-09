import { defineConfig } from "tsup";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";

const { version: pkgVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  outDir: "dist",
  outExtension: () => ({ js: ".cjs" }),
  clean: true,
  // Inject the package.json version at build time so PKG_VERSION can never
  // drift from the published version. release-please's node strategy keeps
  // package.json authoritative.
  define: {
    "process.env.NOTIFIED_PKG_VERSION": JSON.stringify(pkgVersion),
  },
  // Fully bundled — workspace + all npm deps inlined.
  // Required so the same dist/cli.js works both for the npm package and for the
  // Claude Code plugin (which copies dist/cli.js without node_modules).
  noExternal: [/.*/],
  platform: "node",
  target: "node20",
  // Bundled as CJS so commander's require() of Node built-ins works without
  // shims. Node treats .cjs as CommonJS regardless of package.json `type`.
  banner: { js: "#!/usr/bin/env node" },
  esbuildPlugins: [
    {
      // qrcode-terminal uses legacy octal escapes (\033) which ESM strict mode
      // rejects. Rewrite them to hex escapes (\x1b) at load time.
      name: "fix-legacy-octals",
      setup(build) {
        build.onLoad(
          { filter: /qrcode-terminal[\\/].+\.js$/ },
          async (args) => {
            const source = await readFile(args.path, "utf8");
            return {
              contents: source.replace(/\\033/g, "\\x1b"),
              loader: "js",
            };
          },
        );
      },
    },
  ],
});

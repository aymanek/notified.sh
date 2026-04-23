import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          // Provide placeholder secrets so env bindings are defined during tests.
          // `bindings` sets plain-text string bindings (equivalent to secrets in dev mode).
          bindings: {
            MANAGER_BOT_TOKEN: "1234567890:test-manager-bot-token",
            MANAGER_BOT_USERNAME: "testmanagerbot",
            // 32 zero bytes in base64 — valid AES-256 key for test crypto
            AES_KEY_B64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            TG_WEBHOOK_SECRET: "0".repeat(64),
          },
        },
      },
    },
  },
});

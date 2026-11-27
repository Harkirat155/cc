import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // A 1 s ban (the config.js floor) keeps the rate-limit expiry test fast; production keeps the 30 s default.
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { RATE_LIMIT_BAN_DURATION_MS: "1000" } } })],
});

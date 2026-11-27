import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // A 2 s ban lets tests tell retryAfter 2 (trigger) from 1 (later in the ban) and stays fast; production keeps the 30 s default.
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { RATE_LIMIT_BAN_DURATION_MS: "2000" } } })],
});

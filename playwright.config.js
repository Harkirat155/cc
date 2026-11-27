import { defineConfig } from "@playwright/test";

// Two servers: the Worker (wrangler dev, CORS allows the Vite origin) and the Vite client built against it.
const ORIGIN = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 30000,
  use: { baseURL: `${ORIGIN}/cc/` },
  webServer: [
    {
      command: `cd worker && npx wrangler dev --port 8787 --var CORS_ORIGINS:${ORIGIN}`,
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npx vite --port 5173 --strictPort --host 127.0.0.1",
      url: `${ORIGIN}/cc/`,
      reuseExistingServer: false,
      env: { VITE_SOCKET_SERVER: "ws://127.0.0.1:8787", VITE_API_BASE: "http://127.0.0.1:8787" },
    },
  ],
});

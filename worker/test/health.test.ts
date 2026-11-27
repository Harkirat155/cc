import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";

// Top-level keys of getHealthStatus(), server/metrics.js:122-127.
const HEALTH_KEYS = ["checks", "status", "timestamp", "uptime"];
// checks object, server/metrics.js:115-118.
const CHECK_KEYS = ["memory", "rooms"];

describe("GET /health", () => {
  it("returns the server key set as JSON with status 200", async () => {
    const res = await app.fetch(new Request("http://x/health"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(HEALTH_KEYS);
    expect(Object.keys(body.checks as object).sort()).toEqual(CHECK_KEYS);
    expect(body.status).toBe("healthy");
  });

});

describe("unknown route", () => {
  it("returns 404 JSON", async () => {
    const res = await app.fetch(new Request("http://x/no-such-route"), env);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { Hono } from "hono";
import { cors } from "../src/cors";

const call = (path: string, headers: Record<string, string>, origins?: string, method = "GET") =>
  app.fetch(new Request(`http://x${path}`, { method, headers }), {
    ...env,
    ...(origins === undefined ? {} : { CORS_ORIGINS: origins }),
  } as typeof env);
const A = "https://a.example";

describe("cors allow-list", () => {
  it("echoes a listed origin with Vary", async () => {
    const r = await call("/health", { Origin: A }, `${A}, https://b.example`);
    expect(r.status).toBe(200);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(A);
    expect(r.headers.get("Vary")).toContain("Origin");
  });
  it("gives an unlisted origin no allow-origin header", async () => {
    const r = await call("/health", { Origin: "https://evil.example" }, A);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("denies when the variable is unset or empty", async () => {
    for (const v of [undefined, "", " , "]) {
      const r = await call("/health", { Origin: A }, v);
      expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });
  it("does not honour a literal * entry", async () => {
    const r = await call("/health", { Origin: A }, "*");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  it("answers preflight 204 with methods and headers", async () => {
    const r = await call("/health", { Origin: A }, A, "OPTIONS");
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(A);
    expect(r.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST,OPTIONS");
    expect(r.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });
  it("rejects a websocket upgrade from an unlisted origin with 403", async () => {
    const r = await call("/health", { Upgrade: "websocket", Origin: "https://evil.example" }, A);
    expect(r.status).toBe(403);
  });
  it("lets a listed-origin upgrade through", async () => {
    const r = await call("/health", { Upgrade: "websocket", Origin: A }, A);
    expect(r.status).not.toBe(403);
  });
  it("keeps headers on a response a handler built with new Response", async () => {
    const h = new Hono<{ Bindings: { CORS_ORIGINS?: string } }>();
    h.use(cors);
    h.get("/raw", () => new Response("ok"));
    const r = await h.fetch(new Request("http://x/raw", { headers: { Origin: A } }), { CORS_ORIGINS: A });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(A);
    expect(r.headers.get("Vary")).toContain("Origin");
  });
});

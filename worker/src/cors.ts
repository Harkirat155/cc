import type { MiddlewareHandler } from "hono";

// Replaces server/app.js:46-60. Differences from Express, per ADR 0001:
// - Allow-list comes from CORS_ORIGINS (comma-separated). Unset or empty allows no origin
//   (Express defaulted to "*", server/config.js:25).
// - Wildcard decision: a literal "*" entry is NOT honoured. It matches no real Origin, so it
//   silently allows nothing. Every allowed origin must be named, so a copied dev value cannot
//   open production, and later bricks (WebSocket, cookies) inherit a closed default.
// - A WebSocket upgrade with an unlisted Origin is refused 403. A request with no Origin
//   header (non-browser client) is not a cross-site browser request and passes.
export const cors: MiddlewareHandler<{ Bindings: { CORS_ORIGINS?: string } }> = async (c, next) => {
  const allowed = (c.env?.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = c.req.header("Origin");
  const ok = !!origin && allowed.includes(origin);

  if (c.req.header("Upgrade")?.toLowerCase() === "websocket" && origin && !ok) {
    return c.text("forbidden origin", 403);
  }

  const h = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (ok) h.set("Access-Control-Allow-Origin", origin);

  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

  await next();
  // Set on the final Response: Hono drops c.header() values when a handler returns its own Response.
  for (const [k, v] of h) k === "Vary" ? c.res.headers.append(k, v) : c.res.headers.set(k, v);
};

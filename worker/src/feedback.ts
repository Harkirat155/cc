import { Hono } from "hono";
import type { Lobby } from "./lobby";
import { appendFeedbackRow, sheetsConfigured, type SheetsEnv } from "./sheets";

// Port of POST /feedback, server/app.js:103-170, plus the express.json({limit:'32kb'}) behaviour
// of app.js:73-81. Differences: the Sheets append runs in waitUntil, so a configured Worker returns
// sheetsSync "queued" (Express awaits it); unconfigured is "skipped". req.ip is CF-Connecting-IP.
const LIMIT = 32 * 1024; // body-parser '32kb' = 32768 bytes

// Express's default error handler body for the 413 body-parser raises (finalhandler, production).
const PAYLOAD_TOO_LARGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Payload Too Large</pre>
</body>
</html>
`;
const tooLarge = () => new Response(PAYLOAD_TOO_LARGE, {
  status: 413,
  headers: { "Content-Type": "text/html; charset=utf-8" },
});

// Reads at most LIMIT bytes; null when the body is larger (body-parser's entity.too.large).
async function readCapped(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (declared > LIMIT) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMIT) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

export const feedback = new Hono<{ Bindings: { LOBBY: DurableObjectNamespace<Lobby> } & SheetsEnv }>();

feedback.post("/feedback", async (c) => {
  let body: Record<string, unknown> = {};
  // express.json only parses application/json (or +json); any other type leaves req.body = {}.
  if (/^application\/(?:[\w.-]+\+)?json\b/i.test(c.req.header("content-type") ?? "")) {
    const raw = await readCapped(c.req.raw);
    if (raw === null) return tooLarge();
    if (raw.length > 0) {
      // strict mode: first non-space char must be { or [ (body-parser json.js).
      const first = raw.replace(/^[\x20\x09\x0a\x0d]+/, "")[0];
      try {
        if (first !== "{" && first !== "[") throw new SyntaxError();
        body = JSON.parse(raw);
      } catch {
        return c.json({ error: "Invalid JSON payload." }, 400);
      }
    }
  }
  const { rating, message, context = {} } = (body || {}) as Record<string, any>;

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return c.json({ error: "Rating must be a number between 1 and 5." }, 400);
  }
  if (typeof message !== "string" || message.trim().length < 5) {
    return c.json({ error: "Feedback should be at least 5 characters long." }, 400);
  }

  const safeContext = context && typeof context === "object"
    ? {
        roomId: typeof context.roomId === "string" ? context.roomId.slice(0, 32) : undefined,
        isMultiplayer: Boolean(context.isMultiplayer),
        socketId: typeof context.socketId === "string" ? context.socketId.slice(0, 48) : undefined,
        url: typeof context.url === "string" ? context.url.slice(0, 2048) : undefined,
        userAgent: typeof context.userAgent === "string" ? context.userAgent.slice(0, 512) : undefined,
      }
    : undefined;

  const entry = await c.env.LOBBY.getByName("lobby").addFeedback({
    rating: Math.round(numericRating * 10) / 10,
    message: message.trim().slice(0, 2000),
    context: safeContext,
    meta: {
      ip: c.req.header("cf-connecting-ip"),
      origin: c.req.header("origin"),
      referer: c.req.header("referer"),
      userAgent: c.req.header("user-agent"),
    },
  });

  if (!sheetsConfigured(c.env)) return c.json({ status: "received", id: entry.id, sheetsSync: "skipped" }, 201);
  c.executionCtx.waitUntil(
    appendFeedbackRow(c.env, {
      timestamp: entry.receivedAt,
      rating: entry.rating,
      message: entry.message,
      context: entry.context,
      meta: entry.meta,
    }),
  );
  return c.json({ status: "received", id: entry.id, sheetsSync: "queued" }, 201);
});

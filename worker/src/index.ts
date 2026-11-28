import { Hono } from "hono";
import { Lobby } from "./lobby";
import { cors } from "./cors";
import { Room } from "./room";
import { feedback } from "./feedback";
import type { SheetsEnv } from "./sheets";
import { genCode, validateRoomId } from "./validation";

export { Lobby, Room };

// Node records process start at server/metrics.js:17. An isolate has no process,
// so this is the isolate's first request, which resets when the isolate is evicted.
// Set lazily: Workers freeze Date.now() at 0 in global scope, so a module-scope read is 1970.
let isolateStartedAt = 0;

// Same buckets as formatUptime, server/metrics.js:96-105, over isolate age.
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const app = new Hono<{
  Bindings: {
    ROOM: DurableObjectNamespace<Room>;
    LOBBY: DurableObjectNamespace<Lobby>;
    CORS_ORIGINS?: string;
  } & SheetsEnv;
}>();

app.use(cors);

// Keys match getHealthStatus (server/metrics.js:122-127). 200 while healthy (server/app.js:85-88).
app.get("/health", (c) => {
  isolateStartedAt ||= Date.now();
  const checks = {
    // Node: process.memoryUsage().heapUsedMB < 500 (metrics.js:116). Workers expose no
    // process heap. A request that reaches here is inside the 128 MB isolate limit.
    memory: true,
    // Node: rooms.size < 1000 (metrics.js:117). This Worker holds no room map; the count is 0.
    rooms: true,
  };
  return c.json({
    status: "healthy",
    checks,
    // Node: process uptime string (metrics.js:125). Here: how long this isolate has been alive.
    uptime: formatUptime(Date.now() - isolateStartedAt),
    // Node: new Date().toISOString() (metrics.js:126). Same reading.
    timestamp: new Date().toISOString(),
  });
});

app.route("/", feedback);

// Room socket (docs/ws-protocol.md). "new" has the Worker pick a free code (ADR 0001 substitution table);
// the client then sends createRoom. Any other segment is an existing room code.
app.get("/ws/room/:roomId", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") return c.text("expected websocket", 426);
  const raw = c.req.param("roomId");
  if (raw !== "new") {
    const id = validateRoomId(raw);
    if (!id) return c.json({ error: "Invalid room ID" }, 400);
    return c.env.ROOM.getByName(id).fetch(c.req.raw);
  }
  for (let i = 0; i < 10; i++) {
    const id = genCode();
    const stub = c.env.ROOM.getByName(id);
    if (await stub.init(id)) return stub.fetch(c.req.raw);
  }
  return c.json({ error: "Unable to create room, please try again" }, 503);
});

// Lobby socket: one singleton DO, the same name feedback uses.
app.get("/ws/lobby", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") return c.text("expected websocket", 426);
  return c.env.LOBBY.getByName("lobby").fetch(c.req.raw);
});

// Public, read-only list of listed games in progress (docs/live-games.md). No socket or client ids.
app.get("/api/live", async (c) => {
  const lobby = c.env.LOBBY.getByName("lobby");
  const [games, open] = [await lobby.listLive(), await lobby.listOpen()];
  return c.json({ games, open }, 200, { "Cache-Control": "public, max-age=5" });
});

// Agent Arena (docs/arena.md): register a bot name once for a secret key, read the public rated leaderboard.
app.post("/api/bots", async (c) => {
  const body = await c.req.json().catch(() => null);
  const b = body as { name?: unknown; unlisted?: unknown } | null;
  const r = await c.env.LOBBY.getByName("lobby").registerBot(b?.name, c.req.header("CF-Connecting-IP") ?? "unknown", b?.unlisted === true);
  return c.json(r.body, r.status as 201 | 400 | 409 | 429, { "Cache-Control": "no-store" });
});

app.get("/api/arena", async (c) => c.json({ games: await c.env.LOBBY.getByName("lobby").listArena() }, 200, { "Cache-Control": "public, max-age=10" }));

// Last 20 rated games arena-wide (docs/arena.md). Its own path, so no bot name can shadow it.
app.get("/api/arena-feed", async (c) => c.json({ feed: await c.env.LOBBY.getByName("lobby").listFeed() }, 200, { "Cache-Control": "public, max-age=10" }));

// A bot's last 10 rated games (docs/arena.md). One path segment, so it never matches /api/arena/badge/:file.
app.get("/api/arena/:name", async (c) => {
  const name = c.req.param("name");
  const r = /^[A-Za-z0-9 _-]{3,24}$/.test(name) ? await c.env.LOBBY.getByName("lobby").recentGames(name) : null;
  return r ? c.json(r, 200, { "Cache-Control": "public, max-age=10" }) : c.json({ error: "bot not found" }, 404);
});

// One rated game's moves (docs/arena.md). The id is the settlement id from a row's replayId; unknown or pre-replay games are 404.
app.get("/api/replay/:id", async (c) => {
  const id = c.req.param("id");
  const r = id.length <= 64 ? await c.env.LOBBY.getByName("lobby").getReplay(id) : null;
  return r ? c.json(r, 200, { "Cache-Control": "public, max-age=3600" }) : c.json({ error: "replay not found" }, 404);
});

// Rating badge for a bot's README (docs/arena.md): a flat SVG, no storage. Unknown bot or no games: grey "unrated", still 200.
const BADGE_GAMES: Record<string, string> = { ttt: "Tic-Tac-Toe", connect4: "Connect Four", checkers: "Checkers", five: "Five in a Row" };
const XML: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" };
const xml = (s: string) => s.replace(/[<>&"']/g, (ch) => XML[ch]);
app.get("/api/arena/badge/:file", async (c) => {
  const game = c.req.query("game") ?? "";
  if (!Object.hasOwn(BADGE_GAMES, game)) return c.json({ error: "game must be ttt, connect4, checkers or five" }, 400);
  const m = /^(.+)\.svg$/i.exec(c.req.param("file")); // Hono already percent-decodes the param (a malformed escape stays raw)
  if (!m) return c.json({ error: "not found" }, 404);
  const name = m[1];
  const r = name.length <= 24 ? await c.env.LOBBY.getByName("lobby").ratingOf(name, game) : null;
  const left = `CrissCross ${BADGE_GAMES[game]}`;
  const right = r ? String(r.rating) : "unrated";
  const title = `${r ? `${r.name}: ${right}` : "Unrated"} in ${BADGE_GAMES[game]} on CrissCross. A rating is "plays on this server", not proof of strength.`;
  const [lw, rw] = [left.length * 6.5 + 12, right.length * 6.5 + 12];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${xml(left)}: ${xml(right)}"><title>${xml(title)}</title>` +
    `<rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${r ? "#4c1" : "#9f9f9f"}"/>` +
    `<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${lw / 2}" y="14">${xml(left)}</text><text x="${lw + rw / 2}" y="14">${xml(right)}</text></g></svg>`;
  return c.body(svg, 200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": `public, max-age=${r ? 300 : 60}` });
});

// Link-preview card for one replay (docs/ROADMAP.md item 3): names both bots, the game and the result for chat unfurls, then sends
// the browser to the Pages replay. Same read as /api/replay/:id, so whatever getReplay refuses is a 404 here too. Bot names are user-chosen: every value is escaped.
const PAGES = "https://harkirat155.github.io/cc";
const html = (s: string) => s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch]!);
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" };
app.get("/r/:id", async (c) => {
  const id = c.req.param("id");
  // The RPC stub types `moves: unknown[]` as never, so restore the declared shape.
  const r = (id.length <= 64 ? await c.env.LOBBY.getByName("lobby").getReplay(id) : null) as ReturnType<Lobby["getReplay"]>;
  if (!r) {
    return c.html(`<!doctype html><meta charset="utf-8"><title>Replay not found · CrissCross</title><p>No replay with this link. <a href="${PAGES}/arena">Back to the Arena</a></p>`, 404, HTML_HEADERS);
  }
  const [x, o] = r.players;
  const game = Object.hasOwn(BADGE_GAMES, r.gameId) ? BADGE_GAMES[r.gameId] : r.gameId;
  const outcome = r.result === "draw" ? `${x} drew with ${o}` : r.result === "X" ? `${x} beat ${o}` : `${o} beat ${x}`;
  const title = html(`${outcome} at ${game} · CrissCross replay`);
  const desc = html(`A ${game} game in ${r.moves.length} moves. Watch it move by move.`);
  const url = html(new URL(`/r/${encodeURIComponent(id)}`, c.req.url).href);
  const to = html(`${PAGES}/replay/${encodeURIComponent(id)}`);
  const img = `${PAGES}/og-default.png`;
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="CrissCross">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="CrissCross, two-player board games">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p><a href="${to}">${title}</a></p></body></html>`, 200, HTML_HEADERS);
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;

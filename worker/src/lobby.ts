import { DurableObject } from "cloudflare:workers";
import { genCode, validateGameId } from "./validation";
import { buildEntry, MAX_ENTRIES, type FeedbackEntry, type FeedbackInput } from "./feedbackStore";

type Msg = Record<string, unknown>;
interface Att { sid: string }
const LIVE_MAX = 50;
const LIVE_STALE_MS = 10 * 60_000; // no move in 10 min is not a live game
const LIVE_ROWS_MAX = 200; // bounds the table against listPublicly spam between reads
const BOT_NAME = /^[A-Za-z0-9 _-]{3,24}$/;
const REG_PER_HOUR = 3; // registrations per IP per hour
const ARENA_TOP = 20;
const ELO_K = 32;
const ELO_START = 1200; // also the fixed rating of the unlisted guest pool (humans, unregistered bots)
const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
// The house (Room plays seat O, docs/arena.md): rated like a bot, listed under these names. The parentheses are
// outside BOT_NAME, so the exact names cannot be registered; RESERVED also catches "House easy", "house-easy", "HOUSE_HARD".
const HOUSE_NAMES: Record<string, string> = { "house (easy)": "House (easy)", "house (medium)": "House (medium)", "house (hard)": "House (hard)" };
const RESERVED = /^house(easy|medlum|hard)$/; // compared after 0->o, 1/i->l and stripping everything else
const HOUSE_DAILY = 20; // rated house games per bot per UTC day; later ones are played but unrated
type QRow = { sid: string; name: string; game_id: string; joined_at: number };

// Bound by the v1 SQLite migration. Holds the matchmaking queue (server/lobbyManager.js) and the
// feedback ring (server/feedbackStore.js:53), newest MAX_ENTRIES rows.
export class Lobby extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS feedback (seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL)");
    // seq is the FIFO order (lobbyManager sorts by joinedAt; seq is the same order and never ties).
    sql.exec("CREATE TABLE IF NOT EXISTS queue (seq INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL UNIQUE, name TEXT NOT NULL, game_id TEXT NOT NULL, joined_at INTEGER NOT NULL)");
    // Public live-games registry (GET /api/live). Rooms push here; a row is public by construction: no sids.
    sql.exec("CREATE TABLE IF NOT EXISTS live (room_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, x_name TEXT, o_name TEXT, moves INTEGER NOT NULL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
    // Agent Arena (docs/arena.md). Only the SHA-256 of a bot's key and of a registering IP is stored, never either value.
    sql.exec("CREATE TABLE IF NOT EXISTS bots (name TEXT NOT NULL, name_lc TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS bot_reg (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS settled_games (id TEXT PRIMARY KEY)");
    sql.exec("CREATE TABLE IF NOT EXISTS house_games (name_lc TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (name_lc, day))");
    sql.exec("CREATE TABLE IF NOT EXISTS ratings (name_lc TEXT NOT NULL, game_id TEXT NOT NULL, rating REAL NOT NULL, games INTEGER NOT NULL, wins INTEGER NOT NULL, draws INTEGER NOT NULL, losses INTEGER NOT NULL, PRIMARY KEY (name_lc, game_id))");
    // A bot's per-game history (GET /api/arena/:name), written with the rating in recordGame. Additive: rows exist only for games rated after this table shipped. id is an internal order, never served.
    sql.exec("CREATE TABLE IF NOT EXISTS bot_games (id INTEGER PRIMARY KEY AUTOINCREMENT, name_lc TEXT NOT NULL, game_id TEXT NOT NULL, opponent TEXT NOT NULL, result TEXT NOT NULL, rating_after REAL NOT NULL, at INTEGER NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS bot_games_by_bot ON bot_games (name_lc, id)");
    // Operator test bots stay rated but off the leaderboard and the feed (registration with "unlisted": true). Additive: rows are only ever inserted.
    sql.exec("CREATE TABLE IF NOT EXISTS unlisted_bots (name_lc TEXT PRIMARY KEY)");
    sql.exec("INSERT OR IGNORE INTO unlisted_bots (name_lc) VALUES ('smokerecent42775'), ('smokehouse14206')");
  }

  async registerBot(name: unknown, ip: string, unlisted = false): Promise<{ status: number; body: { name?: string; key?: string; error?: string } }> {
    if (typeof name !== "string" || !BOT_NAME.test(name) || name !== name.trim()) return { status: 400, body: { error: "name must be 3-24 characters: letters, digits, space, _ or -, no leading or trailing space" } };
    if (RESERVED.test(name.toLowerCase().replace(/0/g, "o").replace(/[1i]/g, "l").replace(/[^a-z]/g, ""))) return { status: 409, body: { error: "name reserved" } };
    const sql = this.ctx.storage.sql;
    const now = Date.now();
    const [ipHash, raw] = [await sha256(`ip:${ip}`), crypto.getRandomValues(new Uint8Array(24))];
    const key = `ccb_${[...raw].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const keyHash = await sha256(key); // every await is above: the checks and the inserts below run uninterrupted
    sql.exec("DELETE FROM bot_reg WHERE at < ?", now - 3_600_000);
    if (sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM bot_reg WHERE ip_hash = ?", ipHash).one().n >= REG_PER_HOUR) return { status: 429, body: { error: "too many registrations from this address, try again in an hour" } };
    if (sql.exec("SELECT 1 FROM bots WHERE name_lc = ?", name.toLowerCase()).toArray().length) return { status: 409, body: { error: "name already taken" } };
    try {
      sql.exec("INSERT INTO bots (name, name_lc, key_hash, created_at) VALUES (?, ?, ?, ?)", name, name.toLowerCase(), keyHash, now);
    } catch (e) {
      if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(e))) return { status: 409, body: { error: "name already taken" } };
      throw e;
    }
    if (unlisted) sql.exec("INSERT OR IGNORE INTO unlisted_bots (name_lc) VALUES (?)", name.toLowerCase());
    sql.exec("INSERT INTO bot_reg (ip_hash, at) VALUES (?, ?)", ipHash, now);
    return { status: 201, body: { name, key } };
  }

  // The registered name a key belongs to, else null. Rooms call this at join time.
  async verifyBot(key: string): Promise<string | null> {
    const r = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM bots WHERE key_hash = ?", await sha256(key)).toArray();
    return r[0]?.name ?? null;
  }

  // One finished game. `a` and `b` are registered bot names or null (guest, fixed at ELO_START and never stored);
  // `score` is a's result: 1 win, 0.5 draw, 0 loss. Both sides use the ratings from before the game.
  recordGame(id: string, gameId: string, a: string | null, b: string | null, score: 0 | 0.5 | 1): "rated" | "skipped" | "limit" {
    // One transaction: the settled mark, the house counter, both rating upserts and the history rows land together or not at all.
    return this.ctx.storage.transactionSync(() => this.settle(id, gameId, a, b, score));
  }

  private settle(id: string, gameId: string, a: string | null, b: string | null, score: 0 | 0.5 | 1): "rated" | "skipped" | "limit" {
    const sql = this.ctx.storage.sql;
    if (sql.exec("INSERT OR IGNORE INTO settled_games (id) VALUES (?)", id).rowsWritten === 0) return "skipped"; // already rated
    const house = [a, b].some((n) => n && HOUSE_NAMES[n.toLowerCase()]);
    const bot = house ? (a && HOUSE_NAMES[a.toLowerCase()] ? b : a) : null;
    if (bot) {
      const day = new Date().toISOString().slice(0, 10);
      const used = sql.exec<{ n: number }>("SELECT n FROM house_games WHERE name_lc = ? AND day = ?", bot.toLowerCase(), day).toArray()[0]?.n ?? 0;
      if (used >= HOUSE_DAILY) return "limit";
      sql.exec("INSERT INTO house_games (name_lc, day, n) VALUES (?, ?, 1) ON CONFLICT (name_lc, day) DO UPDATE SET n = n + 1", bot.toLowerCase(), day);
    }
    const get = (n: string | null) => (n ? sql.exec<{ rating: number }>("SELECT rating FROM ratings WHERE name_lc = ? AND game_id = ?", n.toLowerCase(), gameId).toArray()[0]?.rating ?? ELO_START : ELO_START);
    const [ra, rb] = [get(a), get(b)];
    const exp = 1 / (1 + 10 ** ((rb - ra) / 400));
    const now = Date.now();
    const put = (n: string | null, r: number, s: number, e: number, opp: string | null) => {
      if (!n) return;
      if (!HOUSE_NAMES[n.toLowerCase()]) sql.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, ?, ?, ?, ?, ?)",
        n.toLowerCase(), gameId, opp ? HOUSE_NAMES[opp.toLowerCase()] ?? opp : "guest", s === 1 ? "win" : s === 0 ? "loss" : "draw", r + ELO_K * (s - e), now);
      sql.exec(
        `INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT (name_lc, game_id) DO UPDATE SET rating = excluded.rating, games = games + 1, wins = wins + excluded.wins, draws = draws + excluded.draws, losses = losses + excluded.losses`,
        n.toLowerCase(), gameId, r + ELO_K * (s - e), s === 1 ? 1 : 0, s === 0.5 ? 1 : 0, s === 0 ? 1 : 0);
    };
    put(a, ra, score, exp, b);
    put(b, rb, 1 - score, 1 - exp, a);
    return "rated";
  }

  // Top ARENA_TOP bots per game. Names and numbers only: no keys, hashes or ids.
  listArena(): Record<string, { name: string; rating: number; games: number; wins: number; draws: number; losses: number }[]> {
    const sql = this.ctx.storage.sql;
    const out: Record<string, any[]> = {};
    for (const { game_id } of sql.exec<{ game_id: string }>("SELECT DISTINCT game_id FROM ratings ORDER BY game_id").toArray()) {
      out[game_id] = sql
        .exec<{ name: string; rating: number; games: number; wins: number; draws: number; losses: number }>(
          "SELECT COALESCE(b.name, r.name_lc) AS name, r.rating, r.games, r.wins, r.draws, r.losses FROM ratings r LEFT JOIN bots b ON b.name_lc = r.name_lc WHERE r.game_id = ? AND (b.name_lc IS NOT NULL OR r.name_lc LIKE 'house (%)') AND r.name_lc NOT IN (SELECT name_lc FROM unlisted_bots) ORDER BY r.rating DESC, r.games DESC, name LIMIT ?", game_id, ARENA_TOP)
        .toArray()
        .map((r) => ({ ...r, name: HOUSE_NAMES[r.name] ?? r.name, rating: Math.round(r.rating) }));
    }
    return out;
  }

  // The last 20 rated bot sides across the arena, newest first (one row per bot per game). Names and numbers only.
  listFeed(): { name: string; gameId: string; result: string; ratingAfter: number; at: number }[] {
    return this.ctx.storage.sql
      .exec<{ name: string; game_id: string; result: string; rating_after: number; at: number }>(
        "SELECT COALESCE(b.name, g.name_lc) AS name, g.game_id, g.result, g.rating_after, g.at FROM bot_games g LEFT JOIN bots b ON b.name_lc = g.name_lc WHERE g.name_lc NOT IN (SELECT name_lc FROM unlisted_bots) ORDER BY g.id DESC LIMIT 20")
      .toArray()
      .map((r) => ({ name: r.name, gameId: r.game_id, result: r.result, ratingAfter: Math.round(r.rating_after), at: r.at }));
  }

  // One registered bot's rating in one game, for the README badge. Null when unregistered or no games. Number only.
  ratingOf(name: string, gameId: string): { name: string; rating: number } | null {
    const r = this.ctx.storage.sql
      .exec<{ name: string; rating: number }>("SELECT b.name, r.rating FROM ratings r JOIN bots b ON b.name_lc = r.name_lc WHERE r.name_lc = ? AND r.game_id = ?", name.toLowerCase(), gameId)
      .toArray()[0];
    return r ? { name: r.name, rating: Math.round(r.rating) } : null;
  }

  // A registered bot's last 10 rated games, newest first. Null when the name is not registered. Names and numbers only.
  recentGames(name: string): { name: string; unlisted?: true; games: { gameId: string; opponent: string; result: string; ratingAfter: number; at: number }[] } | null {
    const sql = this.ctx.storage.sql;
    const lc = name.toLowerCase();
    const bot = sql.exec<{ name: string }>("SELECT name FROM bots WHERE name_lc = ?", lc).toArray()[0];
    if (!bot) return null;
    const games = sql
      .exec<{ game_id: string; opponent: string; result: string; rating_after: number; at: number }>("SELECT game_id, opponent, result, rating_after, at FROM bot_games WHERE name_lc = ? ORDER BY id DESC LIMIT 10", lc)
      .toArray()
      .map((r) => ({ gameId: r.game_id, opponent: r.opponent, result: r.result, ratingAfter: Math.round(r.rating_after), at: r.at }));
    const unlisted = sql.exec("SELECT 1 FROM unlisted_bots WHERE name_lc = ?", lc).toArray().length > 0;
    return unlisted ? { name: bot.name, unlisted: true, games } : { name: bot.name, games };
  }

  reportLive(r: { roomId: string; gameId: string; x: string | null; o: string | null; moves: number; startedAt: number }): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO live (room_id, game_id, x_name, o_name, moves, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      r.roomId, r.gameId, r.x, r.o, r.moves, r.startedAt, Date.now());
    this.ctx.storage.sql.exec(
      "DELETE FROM live WHERE room_id NOT IN (SELECT room_id FROM live ORDER BY updated_at DESC LIMIT ?)", LIVE_ROWS_MAX);
  }

  unlist(roomId: string): void {
    this.ctx.storage.sql.exec("DELETE FROM live WHERE room_id = ?", roomId);
  }

  // Newest game first, at most LIVE_MAX. A row nobody refreshed for LIVE_STALE_MS is a room that vanished
  // without telling us (eviction, deploy), so it is dropped here rather than listed as live.
  listLive() {
    return this.liveRows(">").map((r) => ({ roomId: r.room_id, gameId: r.game_id, players: [r.x_name ?? "Anonymous", r.o_name ?? "Anonymous"], moves: r.moves, startedAt: r.started_at }));
  }

  // Listed rooms with one seat filled and no move played (a live row with moves = 0), newest first, same staleness rule.
  // The room reports an unnamed filled seat as "Anonymous" and an empty seat as null, so the first non-null name is the waiter.
  listOpen() {
    return this.liveRows("=").map((r) => ({ roomId: r.room_id, gameId: r.game_id, name: r.x_name ?? r.o_name ?? "Anonymous", since: r.started_at }));
  }

  private liveRows(cmp: ">" | "=") {
    const sql = this.ctx.storage.sql;
    sql.exec("DELETE FROM live WHERE updated_at < ?", Date.now() - LIVE_STALE_MS);
    return sql
      .exec<{ room_id: string; game_id: string; x_name: string | null; o_name: string | null; moves: number; started_at: number }>(
        `SELECT room_id, game_id, x_name, o_name, moves, started_at FROM live WHERE moves ${cmp} 0 ORDER BY started_at DESC LIMIT ?`, LIVE_MAX)
      .toArray();
  }

  // addPlayer, lobbyManager.js:26. Same checks in the same order, same messages.
  enqueue(sid: string, displayName: unknown, gameId: unknown): { success: boolean; error?: string; position?: number } {
    const name = String(displayName || "").trim();
    if (name.length < 2) return { success: false, error: "Display name must be at least 2 characters" };
    if (name.length > 20) return { success: false, error: "Display name must be 20 characters or less" };
    const sql = this.ctx.storage.sql;
    const size = sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM queue").one().n;
    const max = parseInt(String((this.env as Record<string, unknown>).LOBBY_MAX_QUEUE_SIZE), 10);
    if (size >= (Number.isNaN(max) ? 100 : Math.max(10, Math.min(1000, max)))) return { success: false, error: "Matchmaking queue is full, please try again later" };
    if (sql.exec("SELECT 1 FROM queue WHERE sid = ?", sid).toArray().length) return { success: false, error: "Already in lobby" };
    sql.exec("INSERT INTO queue (sid, name, game_id, joined_at) VALUES (?, ?, ?, ?)", sid, name, validateGameId(gameId) ?? "ttt", Date.now());
    return { success: true, position: size };
  }

  private dequeue(sid: string): boolean {
    return this.ctx.storage.sql.exec("DELETE FROM queue WHERE sid = ?", sid).rowsWritten > 0;
  }

  private queueState() {
    return this.ctx.storage.sql
      .exec<QRow>("SELECT sid, name, game_id, joined_at FROM queue ORDER BY seq")
      .toArray()
      .map((r) => ({ socketId: r.sid, displayName: r.name, gameId: r.game_id, joinedAt: r.joined_at }));
  }

  // Debounced lobbyUpdate (broadcastLobbyState, lobbyManager.js:187). Express resets the timer on every
  // change; here the first change arms the alarm and later changes inside the window ride on it, so a
  // steady stream still updates every LOBBY_MATCH_DEBOUNCE_MS (config.js:39: default 100, clamp 0-1000).
  private async touched() {
    const ms = parseInt(String((this.env as Record<string, unknown>).LOBBY_MATCH_DEBOUNCE_MS), 10);
    const debounce = Number.isNaN(ms) ? 100 : Math.max(0, Math.min(1000, ms));
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + debounce);
  }

  // matchPlayers + handleMatch (lobbyManager.js:111, lobbyHandlers.js:104): the two longest-waiting
  // players get a fresh Room and a one-time seat token each; the first (and its game) is X.
  private async match() {
    const sql = this.ctx.storage.sql;
    const [p1, p2] = sql.exec<QRow>("SELECT sid, name, game_id, joined_at FROM queue ORDER BY seq LIMIT 2").toArray();
    if (!p2) return;
    sql.exec("DELETE FROM queue WHERE sid IN (?, ?)", p1.sid, p2.sid);
    await this.touched();
    const seats = [{ seat: "X" as const, token: crypto.randomUUID(), name: p1.name }, { seat: "O" as const, token: crypto.randomUUID(), name: p2.name }];
    const players = [p1, p2];
    let roomId: string | null = null;
    const env = this.env as unknown as { ROOM: DurableObjectNamespace<import("./room").Room> };
    try {
      for (let i = 0; i < 10 && !roomId; i++) {
        const code = genCode();
        if (await env.ROOM.getByName(code).reserveSeats(code, p1.game_id, seats)) roomId = code;
      }
    } catch { /* roomId stays null: matchError, and like handleMatch (lobbyHandlers.js:113) no requeue */ }
    const to = (sid: string, frame: object) => {
      for (const w of this.ctx.getWebSockets()) if ((w.deserializeAttachment() as Att).sid === sid) try { w.send(JSON.stringify(frame)); } catch { /* closing */ }
    };
    players.forEach((p, i) => to(p.sid, roomId
      ? { t: "matchFound", d: { roomId, player: seats[i].seat, token: seats[i].token, opponent: players[1 - i].name } }
      : { t: "matchError", d: { error: "Failed to create room" } }));
  }

  async alarm() {
    const text = JSON.stringify({ t: "lobbyUpdate", d: { queue: this.queueState(), timestamp: Date.now() } });
    for (const w of this.ctx.getWebSockets()) try { w.send(text); } catch { /* closing */ }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;
    let f: { t?: unknown; id?: unknown; d?: unknown };
    try { f = JSON.parse(raw); } catch { return; }
    if (!f || typeof f !== "object") return;
    const data: Msg = f.d && typeof f.d === "object" ? (f.d as Msg) : {};
    const ack = (body: unknown) => { if (Number.isInteger(f.id)) ws.send(JSON.stringify({ t: "ack", id: f.id, d: body })); };
    const sid = (ws.deserializeAttachment() as Att).sid;
    switch (f.t) {
      case "joinLobby": {
        const r = this.enqueue(sid, data.displayName, data.gameId);
        if (r.success) await this.touched();
        ack(r.success ? { success: true, position: r.position } : r);
        if (r.success) await this.match();
        break;
      }
      case "leaveLobby": {
        const removed = this.dequeue(sid);
        if (removed) await this.touched();
        ack(removed ? { success: true } : { success: false, error: "Not in lobby" });
        break;
      }
      case "getLobbyState": ack({ queue: this.queueState() }); break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    if (this.dequeue((ws.deserializeAttachment() as Att).sid)) await this.touched();
    try { ws.close(1000); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    if (this.dequeue((ws.deserializeAttachment() as Att).sid)) await this.touched();
  }

  addFeedback(input: FeedbackInput): FeedbackEntry {
    const entry = buildEntry(input);
    const sql = this.ctx.storage.sql;
    sql.exec("INSERT INTO feedback (entry) VALUES (?)", JSON.stringify(entry));
    sql.exec("DELETE FROM feedback WHERE seq <= (SELECT MAX(seq) FROM feedback) - ?", MAX_ENTRIES);
    return entry;
  }

  // Newest first, like listFeedback (feedbackStore.js:71).
  listFeedback(limit = 20): FeedbackEntry[] {
    if (limit <= 0) return [];
    return this.ctx.storage.sql
      .exec<{ entry: string }>("SELECT entry FROM feedback ORDER BY seq DESC LIMIT ?", limit)
      .toArray()
      .map((r) => JSON.parse(r.entry));
  }

  fetch(req: Request): Response {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const sid = crypto.randomUUID();
    server.serializeAttachment({ sid } satisfies Att);
    server.send(JSON.stringify({ t: "hello", d: { sid } }));
    return new Response(null, { status: 101, webSocket: client });
  }
}

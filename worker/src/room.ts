import { DurableObject } from "cloudflare:workers";
import { validateDisplayName, validateGameId, validateIndex, validateRoomId } from "./validation";
import { get as getRules } from "../../shared/games/registry.js";
import { SLOT_TO_MARK } from "../../shared/games/ttt.js";
import { chooseMove } from "../../shared/ai/bot.js";

type Seat = "X" | "O";
// Mirrors the room fields of server/roomManager.js:83-98 that bricks 5 touches. Socket ids are
// per-socket uuids kept in the socket attachment, so they outlive hibernation.
interface RoomState {
  roomId: string;
  created: boolean; // false = code reserved by the Worker, createRoom not yet received
  gameId: string;
  players: { X: string | null; O: string | null };
  spectators: string[];
  seatByClient: Record<string, Seat>;
  names: { X: string | null; O: string | null };
  // Game state, shared/games slot-indexed shape (server/roomManager.js:83-98). Plain JSON, so it
  // survives the storage round trip. Room-level fields mirror Express: they are not in `state`.
  state: any;
  lastMove: unknown;
  lastEvents: unknown;
  lastMoveBy: number | null;
  newGameRequester: string | null;
  newGameRequestedAt: number | null;
  // sid of the player whose draw offer is pending. Cleared by a move, a reset, a switch or the game ending.
  drawOfferer: string | null;
  // One-time seat tokens from Lobby.reserveSeats (brick 8): token -> seat and expiry (ms epoch).
  seatTokens: Record<string, { seat: Seat; exp: number }>;
  // Voice chat members (brick 9): sid -> muted. Room state, not attachment, so publish reads one place.
  voice: Record<string, { muted: boolean }>;
  // server/roomManager.js touch(): ms epoch of the last game, room or voice event. Saved with the next save.
  lastTouched: number;
  // Public listing (GET /api/live): lobby-matched rooms and rooms created with listPublicly. Moves played in
  // the current game and when its first move landed; both reset with the board.
  listed: boolean;
  moves: number;
  startedAt: number | null;
  // Agent Arena: registered bot name per sid, set when a socket presents a valid botKey. A seat's sid changes
  // on reconnect, so a bot presents its key again on every join. Settled: this game's result was already rated.
  botBySid: Record<string, string>;
  settled: boolean;
  // Moves of the current game as lastMove-shaped objects, and the seat that moved first: the replay stored with a rated game. Absent on a room saved before replays.
  log?: unknown[];
  first?: number;
  // Who is rated for the current game, frozen when its first move lands: later key changes or a substitute do not count.
  rated: { id: string; X: string | null; O: string | null; sidX: string | null; sidO: string | null } | null;
  // The house level when seat O is played by the Room itself (createRoom vsHouse), else null.
  house: HouseLevel | null;
  // House rooms: ms epoch when the departed bot's seat is settled as a resignation (the alarm fires it). While set, X is held
  // for that bot: its clientId rebinds, or its botKey rejoins, and either clears it; nobody else is seated at X.
  abandonAt: number | null;
}
const LOG_MAX = 500; // moves kept per game for its replay
const HOUSE_GRACE_MS = 30_000;
// The house (docs/arena.md): the Room plays seat O with shared/ai/bot.js. workerd freezes Date.now() during CPU
// work, so bot.js's own 300 ms deadline never fires on hard; measured with a frozen clock, hard took 4.7 s a move on
// Connect Four and far longer on Five in a Row. So the compute cap is the level: hard only where the search is
// trivial (ttt), medium (depth 2) elsewhere. Anything above the cap is refused, never silently downgraded.
export const HOUSE_SID = "house"; // not a socket: it can never be live, so it is exempt from the stale-seat sweep
const HOUSE_LEVELS = ["easy", "medium", "hard"] as const;
type HouseLevel = (typeof HOUSE_LEVELS)[number];
export const houseName = (l: string) => `House (${l})`;
// Five in a Row scans the whole 15x15 board per evaluation and bot.js has no node budget at medium, so it is easy only.
const HOUSE_MAX: Record<string, HouseLevel> = { ttt: "hard", connect4: "medium", checkers: "medium", five: "easy" };
const houseMax = (gameId: string): HouseLevel => HOUSE_MAX[gameId] ?? "easy";
const mulberry32 = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// Same room, same position, same reply: the seed is the room code and the move count.
const seed = (id: string, n: number) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, n);
// voice:signal payload cap, serialized. Express had none beyond the Socket.IO 1 MB frame.
const MAX_SIGNAL_BYTES = 64 * 1024;
// Express kept a matched seat across a reconnect for 2 min (connectionStateRecovery, app.js:186).
const TOKEN_TTL_MS = 120_000;
interface Att {
  sid: string;
  joined: boolean;
  // Rate limit state of server/rateLimiter.js, per socket: events in the current window, its start, ban end.
  rl?: { n: number; at: number; until: number };
}
// The only reactions the room relays; no free text, so nothing to moderate. One per EMOTE_GAP_MS per seat.
const EMOTES = ["👍", "😮", "😅", "🤝"];
const EMOTE_GAP_MS = 2000;
// RATE_LIMIT_* of server/config.js:33-35, same names, defaults and clamps.
const envInt = (v: unknown, def: number, min: number, max: number) => {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? def : Math.max(min, Math.min(max, n));
};
type Msg = Record<string, unknown>;

const fresh = (roomId: string): RoomState => ({
  roomId,
  created: false,
  gameId: "ttt",
  players: { X: null, O: null },
  spectators: [],
  seatByClient: {},
  names: { X: null, O: null },
  state: getRules("ttt").createInitialState(),
  lastMove: null,
  lastEvents: null,
  lastMoveBy: null,
  newGameRequester: null,
  newGameRequestedAt: null,
  drawOfferer: null,
  seatTokens: {},
  voice: {},
  lastTouched: Date.now(),
  listed: false,
  moves: 0,
  startedAt: null,
  botBySid: {},
  settled: false,
  rated: null,
  house: null,
  abandonAt: null,
});
const clearRequest = (s: RoomState) => { s.newGameRequester = null; s.newGameRequestedAt = null; };
const clearOffer = (s: RoomState) => { s.drawOfferer = null; };
const clearLast = (s: RoomState) => { s.lastMove = null; s.lastEvents = null; s.lastMoveBy = null; };

export class Room extends DurableObject {
  private s: RoomState | null = null;
  private armed = false; // an alarm is known to be set, so frames skip the getAlarm read
  private reported: string | null = null; // last listing state sent to the Lobby registry, so unchanged publishes send nothing
  private openedAt: number | null = null; // when this room began waiting with an open seat (in memory: resets if the room restarts)
  private lastReact: [number, number] = [0, 0]; // ms epoch of each seat's last accepted reaction (in memory, never stored)
  private after: (() => void)[] = []; // broadcasts that follow the ack, as io emits after ack() in roomHandlers.js

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const st = (await ctx.storage.get<RoomState>("room")) ?? null;
      if (st && (!st.state || typeof st.state !== "object")) {
        // Rooms stored before brick 6 have no game state and an unvalidated gameId (brick 5 createRoom).
        st.gameId = validateGameId(st.gameId) ?? "ttt";
        st.state = getRules(st.gameId).createInitialState();
      }
      this.s = st && { ...fresh(st.roomId), ...st };
      await this.arm(); // one getAlarm read on wake, so a room that lost its alarm gets one
    });
  }

  // Worker calls this with a server-picked code. False means the code is taken: pick another.
  async init(roomId: string): Promise<boolean> {
    if (this.s) return false;
    this.s = fresh(roomId);
    await this.save();
    await this.arm();
    return true;
  }

  // Lobby calls this for a match (setupMatchedRoom, lobbyHandlers.js:60): the room exists with both
  // names and the game, and each seat is claimable once by its token through joinRoom. False = code taken.
  async reserveSeats(roomId: string, gameId: string, seats: { seat: Seat; token: string; name: string }[]): Promise<boolean> {
    if (!(await this.init(roomId))) return false;
    const s = this.s!;
    s.created = true;
    s.listed = true; // a lobby match is public: anyone queued for a game agreed to be paired and seen
    if (s.gameId !== gameId) { s.gameId = gameId; s.state = getRules(gameId).createInitialState(); }
    for (const q of seats) {
      s.names[q.seat] = q.name;
      s.seatTokens[q.token] = { seat: q.seat, exp: Date.now() + TOKEN_TTL_MS };
    }
    await this.save();
    await this.arm();
    return true;
  }

  fetch(req: Request): Response {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const sid = crypto.randomUUID();
    server.serializeAttachment({ sid, joined: false } satisfies Att);
    server.send(JSON.stringify({ t: "hello", d: { sid } }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    // Every frame counts, parseable or not, as every Socket.IO event does in rateLimiter.js.
    const retryAfter = this.limited(ws);
    if (retryAfter) {
      ws.send(JSON.stringify({ t: "error", d: { code: "RATE_LIMITED", message: `Too many requests. Retry after ${retryAfter}s`, retryAfter } }));
      return;
    }
    if (typeof raw !== "string") return;
    let f: unknown;
    try {
      f = JSON.parse(raw);
    } catch {
      return;
    }
    if (!f || typeof f !== "object") return;
    const { t, id, d } = f as { t?: unknown; id?: unknown; d?: unknown };
    const data: Msg = d && typeof d === "object" ? (d as Msg) : {};
    const ack = (body: unknown) => {
      if (Number.isInteger(id)) ws.send(JSON.stringify({ t: "ack", id, d: body }));
    };
    this.touch(); // every game, room and voice event, as touch() does in the Express handlers
    switch (t) {
      case "createRoom": ack(await this.createRoom(ws, data)); break;
      case "joinRoom": ack(await this.joinRoom(ws, data)); break;
      case "updateDisplayName": await this.updateName(ws, data); break;
      case "leaveRoom": ack(await this.leaveRoom(ws, data)); break;
      case "makeMove": await this.makeMove(ws, data); break;
      case "resetGame": await this.resetGame(ws, data); break;
      case "resetScores": await this.game(data, (s) => { s.state = { ...s.state, scores: [0, 0] }; }, ws); break;
      case "requestNewGame": await this.game(data, (s) => { s.newGameRequester = this.att(ws).sid; s.newGameRequestedAt = Date.now(); }, ws); break;
      case "cancelNewGameRequest": await this.game(data, clearRequest, ws); break;
      case "resign": await this.resign(ws, data); break;
      case "offerDraw": await this.game(data, (s) => { if (this.live(s)) s.drawOfferer = this.att(ws).sid; }, ws); break;
      case "cancelDrawOffer": await this.game(data, (s) => { if (s.drawOfferer === this.att(ws).sid) clearOffer(s); }, ws); break;
      case "declineDraw": await this.game(data, (s) => { if (s.drawOfferer && s.drawOfferer !== this.att(ws).sid) clearOffer(s); }, ws); break;
      case "acceptDraw": await this.game(data, (s) => {
        if (!this.live(s) || !s.drawOfferer || s.drawOfferer === this.att(ws).sid) return;
        s.state = { ...s.state, status: "draw", winner: null, winningCells: [] };
        clearOffer(s);
      }, ws); break;
      case "emote": this.emote(ws, data); break;
      case "switchGame": ack(await this.switchGame(ws, data)); break;
      case "voice:join": await this.voiceSet(ws, data, "voice:user-joined"); break;
      case "voice:mute-state": await this.voiceSet(ws, data, "voice:mute-state"); break;
      case "voice:leave": await this.voiceLeave(ws, data); break;
      case "voice:signal": this.voiceSignal(ws, data); break;
    }
    for (const f of this.after.splice(0)) f();
    await this.arm();
  }

  // Room GC, server/roomGC.js: delete only a room with no occupants and now - lastTouched > ROOM_TTL_MS
  // (config.js:29: default 120000, clamp 10000-3600000). An unexpired seat token also keeps it, so a
  // matched room outlives its tokens whatever the TTL. The alarm only ever re-arms at the deadline.
  async alarm(): Promise<void> {
    this.armed = false;
    const s = this.s;
    if (!s) return;
    if (s.abandonAt && Date.now() >= s.abandonAt) { this.abandon(s); await this.save(); }
    const live = new Set(this.ctx.getWebSockets().map((w) => this.att(w).sid));
    const occupied = !!((s.players.X && live.has(s.players.X)) || (s.players.O && live.has(s.players.O)) || s.spectators.some((x) => live.has(x)));
    const due = Math.max(s.lastTouched + this.ttl(), ...Object.values(s.seatTokens).map((q) => q.exp));
    if (occupied || Date.now() <= due || s.abandonAt) {
      const next = occupied ? Date.now() + this.ttl() : Date.now() <= due ? due : Infinity; // GC due: wait for the grace
      await this.ctx.storage.setAlarm(Math.min(next, s.abandonAt ?? Infinity));
      this.armed = true;
      return;
    }
    const sockets = this.ctx.getWebSockets();
    if (s.listed) this.ctx.waitUntil(this.lobby().unlist(s.roomId).catch(() => {}));
    this.s = null;
    await this.ctx.storage.deleteAll();
    for (const w of sockets) try { w.close(1000, "room expired"); } catch { /* already closed */ }
  }

  private lobby() {
    return (this.env as unknown as { LOBBY: DurableObjectNamespace<import("./lobby").Lobby> }).LOBBY.getByName("lobby");
  }

  // Tell the Lobby registry behind GET /api/live whether this room is a listed game in progress. Only
  // names, game, move count and start time leave the room; never socket ids or client ids.
  private report(s: RoomState) {
    if (!s.listed) return;
    // A row with moves = 0 is an open seat: one seat filled, nothing played, and the empty seat claimable by a
    // tokenless join (not held by a lobby match's token or for a returning creator, as joinRoom's held()).
    // Two seats and no move is unlisted.
    const empty = (["X", "O"] as const).filter((k) => !s.players[k]);
    const held = (k: Seat) => Object.values(s.seatTokens).some((q) => q.seat === k && q.exp > Date.now()) || (k === "X" && !!s.abandonAt);
    const waiting = s.state?.status === "active" && s.moves === 0 && empty.length === 1 && !held(empty[0]);
    this.openedAt = waiting ? (this.openedAt ?? Date.now()) : null;
    const on = (this.live(s) && s.moves > 0) || waiting;
    const nm = (k: "X" | "O") => (s.players[k] ? s.names[k] ?? "Anonymous" : null);
    const row = { roomId: s.roomId, gameId: s.gameId, x: nm("X"), o: nm("O"), moves: s.moves, startedAt: s.startedAt ?? this.openedAt ?? Date.now() };
    const key = on ? JSON.stringify(row) : "off";
    if (key === this.reported) return;
    this.reported = key;
    try { // the registry is best-effort: it must never break the broadcast that follows
      const lobby = this.lobby();
      this.ctx.waitUntil((on ? lobby.reportLive(row) : lobby.unlist(s.roomId)).catch(() => { this.reported = null; }));
    } catch { this.reported = null; }
  }

  // Agent Arena. undefined: no key presented; false: key not registered; else the bot's registered name.
  private async bot(key: unknown): Promise<{ name: string | null } | { error: string }> {
    if (key === undefined || key === null) return { name: null };
    if (typeof key !== "string" || !key) return { error: "Invalid bot key" };
    try {
      const name = await this.lobby().verifyBot(key);
      return name ? { name } : { error: "Invalid bot key" };
    } catch { return { error: "Arena unavailable, try again" }; }
  }

  // Rate a finished game once: two seated players, a move played, at least one registered bot, and not the
  // same bot on both sides. Everyone else is the fixed guest pool and is never stored. Best-effort like report().
  private settle(s: RoomState) {
    if (s.state?.status === "active") { s.settled = false; return; }
    const st = s.state?.status;
    if (s.settled || (st !== "win" && st !== "draw") || s.moves < 1 || !s.rated) return;
    const { id, X: x, O: o, sidX, sidO } = s.rated;
    s.settled = true;
    void this.save();
    // A different sid in an occupied seat is a substitute: it does not inherit the result. An empty seat is fine.
    if ((s.players.X && s.players.X !== sidX) || (s.players.O && s.players.O !== sidO)) return;
    if ((!x && !o) || (s.house && (!x || !o)) || (x && o && x.toLowerCase() === o.toLowerCase())) return;
    const score = st === "draw" ? 0.5 : s.state.winner === 0 ? 1 : 0;
    try {
      this.ctx.waitUntil(this.lobby().recordGame(id, s.gameId, x, o, score, s.first !== undefined && s.log && s.log.length === s.moves ? { first: s.first as 0 | 1, moves: s.log } : undefined)
        .then((r) => { if (r === "limit") this.broadcast({ t: "unrated", d: { reason: "daily house limit", gameId: id } }); })
        .catch(() => {}));
    } catch { /* the leaderboard must never break the broadcast */ }
  }

  private ttl() {
    return envInt((this.env as Record<string, unknown>).ROOM_TTL_MS, 120_000, 10_000, 3_600_000);
  }

  private touch() {
    if (this.s) this.s.lastTouched = Date.now();
  }

  private async arm() {
    if (this.armed || !this.s) return;
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(this.s.lastTouched + this.ttl());
    this.armed = true;
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.drop(ws);
    try { ws.close(1000); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.drop(ws);
  }

  // cleanupSocket, server/roomManager.js:143: free the seat, keep the clientId reservation.
  private async drop(ws: WebSocket): Promise<void> {
    const s = this.s;
    const sid = this.att(ws).sid;
    if (!s || !sid) return;
    this.touch();
    const voiced = this.dropVoice(s, sid);
    const wasX = s.players.X === sid;
    if (!this.free(s, sid) && !voiced) return;
    // House rooms: walking away from a game in progress is a resignation, after a grace for a normal reconnect.
    if (s.house && wasX && s.state?.status === "active" && s.moves > 0) {
      s.abandonAt = Date.now() + HOUSE_GRACE_MS;
      const at = await this.ctx.storage.getAlarm();
      if (at === null || at > s.abandonAt) await this.ctx.storage.setAlarm(s.abandonAt);
      this.armed = true;
    }
    await this.save();
    await this.arm();
    this.publish(ws);
  }

  private abandon(s: RoomState) {
    s.abandonAt = null;
    if (s.state?.status === "active") {
      s.state = { ...s.state, status: "win", winner: 1, winningCells: [], scores: [s.state.scores?.[0] || 0, (s.state.scores?.[1] || 0) + 1] };
      clearOffer(s);
    }
    this.publish();
  }

  private async createRoom(ws: WebSocket, p: Msg) {
    const s = this.s;
    if (!s || s.created) return { error: "Unable to create room, please try again" };
    const bot = await this.bot(p.botKey);
    if ("error" in bot) return bot;
    const gameId = validateGameId(p.gameId); // roomManager.js:81 falls back to ttt for an unknown id
    let house: HouseLevel | null = null;
    if (p.vsHouse !== undefined) {
      house = HOUSE_LEVELS.find((l) => l === p.vsHouse) ?? null;
      if (!house) return { error: "vsHouse must be easy, medium or hard" };
      if (!bot.name) return { error: "vsHouse needs a botKey" }; // a guest would feed the house a rating
      if (HOUSE_LEVELS.indexOf(house) > HOUSE_LEVELS.indexOf(houseMax(gameId ?? "ttt"))) return { error: `the house plays up to ${houseMax(gameId ?? "ttt")} at ${gameId ?? "ttt"}` };
    }
    const clientId = typeof p.clientId === "string" && p.clientId ? p.clientId : null;
    const sid = this.att(ws).sid;
    s.created = true;
    s.listed = p.listPublicly === true && !house; // a house room is never public
    s.players.X = sid;
    if (bot.name) s.botBySid[sid] = bot.name;
    s.names.X = validateDisplayName(p.displayName);
    if (house) {
      s.house = house;
      s.players.O = HOUSE_SID;
      s.names.O = houseName(house);
      s.botBySid[HOUSE_SID] = houseName(house);
    }
    if (gameId && gameId !== s.gameId) { s.gameId = gameId; s.state = getRules(gameId).createInitialState(); }
    if (clientId) s.seatByClient[clientId] = "X";
    this.setJoined(ws, true);
    await this.save();
    this.after.push(() => this.publish(ws));
    return house ? { roomId: s.roomId, player: "X", house: houseName(house) } : { roomId: s.roomId, player: "X" };
  }

  // server/handlers/roomHandlers.js:65-151.
  private async joinRoom(ws: WebSocket, p: Msg) {
    if (!validateRoomId(p.roomId)) return { error: "Invalid room ID" };
    const s = this.s;
    if (!s?.created || s.roomId !== validateRoomId(p.roomId)) return { error: "Room not found" };
    const sid = this.att(ws).sid;
    const bot = await this.bot(p.botKey);
    if ("error" in bot) return bot;
    if (!bot.name) delete s.botBySid[sid];
    // A seat held by a sid with no live socket is stale (eviction can close sockets without a close event).
    const live = new Set(this.ctx.getWebSockets().map((w) => this.att(w).sid));
    for (const k of ["X", "O"] as const) if (s.players[k] && s.players[k] !== HOUSE_SID && !live.has(s.players[k]!)) s.players[k] = null;
    s.spectators = s.spectators.filter((x) => live.has(x));
    const clientId = typeof p.clientId === "string" && p.clientId ? p.clientId : null;
    const name = validateDisplayName(p.displayName);
    let role: Seat | "spectator" | null = null;

    // Expired tokens are dropped when seen, so storage does not grow and their seat opens up.
    const now = Date.now();
    const expired = Object.keys(s.seatTokens).filter((k) => now > s.seatTokens[k].exp);
    for (const k of expired) delete s.seatTokens[k];
    if (expired.length) await this.save();
    const mapped = clientId ? s.seatByClient[clientId] : undefined;

    // 0) seat token from matchFound: exactly the seat it names, once. A clientId that already owns a
    // seat rebinds below and ignores the token, so a retry after a lost ack succeeds.
    if (p.token !== undefined) {
      const tok = typeof p.token === "string" ? s.seatTokens[p.token] : undefined;
      if (!clientId) return { error: "clientId required with seat token" };
      if (mapped) {
        if (tok && tok.seat !== mapped) return { error: "Already seated" };
        if (tok) delete s.seatTokens[p.token as string];
      } else {
        if (!tok) return { error: "Invalid or used seat token" };
        const other = tok.seat === "X" ? "O" : "X";
        if (s.players[other] === sid) return { error: "Already seated" };
        if (s.players[tok.seat] && s.players[tok.seat] !== sid) return { error: "Seat taken" };
        delete s.seatTokens[p.token as string];
        s.players[tok.seat] = sid;
        s.seatByClient[clientId] = tok.seat;
        if (name) s.names[tok.seat] = name;
        role = tok.seat;
      }
    }
    // 1) rebind by clientId
    if (!role && (mapped === "X" || mapped === "O")) {
      if (!s.players[mapped] || s.players[mapped] === sid) {
        s.players[mapped] = sid;
        if (name) s.names[mapped] = name;
        const other = mapped === "X" ? "O" : "X";
        if (s.players[other] === sid) s.players[other] = null;
        role = mapped;
      }
    }
    // 2) socket already seated
    if (!role) {
      if (s.players.X === sid) { role = "X"; if (name) s.names.X = name; }
      else if (s.players.O === sid) { role = "O"; if (name) s.names.O = name; }
    }
    // A seat with an unclaimed matchFound token is not open to a tokenless join.
    const held = (k: Seat) => Object.values(s.seatTokens).some((q) => q.seat === k) || (k === "X" && !!s.abandonAt && !(bot.name && bot.name === s.rated?.X));
    // 3) open seat. A clientId that owns a seat is never given the other one.
    if (!role) {
      // A clientId that already owns a seat (held by a live socket, so rebind skipped it) never gets the other one.
      // Express would double-seat here (roomHandlers.js:121 has the guard only on the O branch); this is deliberately safer.
      if (mapped) {
        role = "spectator";
      } else if (!s.players.X && !held("X")) {
        s.players.X = sid; role = "X"; if (clientId) s.seatByClient[clientId] = "X"; s.names.X = name;
      } else if (!s.players.O && !held("O")) {
        s.players.O = sid; role = "O"; if (clientId) s.seatByClient[clientId] = "O"; s.names.O = name;
      } else {
        role = "spectator";
      }
    }
    // A held seat goes back only to the rated bot itself (its botKey), never to a clientId alone.
    if (role === "X" && s.abandonAt) {
      if (bot.name && bot.name === s.rated?.X) { s.abandonAt = null; if (s.rated) s.rated.sidX = sid; }
      else { if (s.players.X === sid) s.players.X = null; role = "spectator"; }
    }
    if (role === "spectator") {
      if (!s.spectators.includes(sid)) s.spectators.push(sid);
    } else {
      s.spectators = s.spectators.filter((x) => x !== sid);
    }
    if (bot.name && role !== "spectator") s.botBySid[sid] = bot.name;
    this.setJoined(ws, true);
    await this.save();
    this.after.push(() => {
      if (s.players.X && s.players.O) this.broadcast({ t: "startGame" });
      this.publish(ws);
    });
    return { player: role };
  }

  private async updateName(ws: WebSocket, p: Msg) {
    const s = this.s;
    const name = validateDisplayName(p.displayName);
    if (!s?.created || !name || validateRoomId(p.roomId) !== s.roomId) return;
    const sid = this.att(ws).sid;
    const seat: Seat | null = s.players.X === sid ? "X" : s.players.O === sid ? "O" : null;
    if (!seat) return;
    s.names[seat] = name;
    await this.save();
    this.publish(ws);
  }

  private async leaveRoom(ws: WebSocket, p: Msg) {
    if (!validateRoomId(p.roomId)) return { error: "Invalid room ID" };
    const s = this.s;
    if (!s?.created || s.roomId !== validateRoomId(p.roomId)) return { error: "Room not found" };
    const clientId = typeof p.clientId === "string" ? p.clientId : null;
    const sid = this.att(ws).sid;
    const voiced = this.dropVoice(s, sid);
    const changed = this.free(s, sid);
    const hadSeat = !!clientId && clientId in s.seatByClient;
    if (clientId) delete s.seatByClient[clientId];
    if (!changed) {
      if (hadSeat || voiced) await this.save(); // the reservation delete must survive hibernation
      if (voiced) this.publish(ws);
      return { error: "Not in room" };
    }
    this.setJoined(ws, false);
    await this.save();
    this.after.push(() => this.publish(ws));
    return { ok: true };
  }

  // The room, or null when the roomId is invalid or not this room: the common gate of every game event.
  private room(roomId: unknown): RoomState | null {
    const s = this.s;
    return s?.created && validateRoomId(roomId) === s.roomId ? s : null;
  }

  // Run an unacked room-level mutation from a seated player, save, publish. The mutation runs before the
  // first await. Express lets spectators run these too; seating them is deliberately stricter.
  private async game(p: Msg, fn: (s: RoomState) => void, ws: WebSocket): Promise<boolean> {
    const s = this.room(p.roomId);
    if (!s || this.slot(s, ws) < 0) return false;
    fn(s);
    await this.save();
    this.publish(ws);
    return true;
  }

  private slot(s: RoomState, ws: WebSocket): 0 | 1 | -1 {
    const sid = this.att(ws).sid;
    return s.players.X === sid ? 0 : s.players.O === sid ? 1 : -1;
  }

  // server/handlers/gameHandlers.js:59. Illegal moves drop silently.
  private async makeMove(ws: WebSocket, p: Msg) {
    const s = this.room(p.roomId);
    if (!s) return;
    const slot = this.slot(s, ws);
    if (slot === -1) return;
    const move = p.move || (validateIndex(p.index) ? { type: "place", cell: p.index } : null);
    if (!move || !this.play(s, slot, move)) return;
    this.houseReply(s);
    await this.save();
    this.publish(ws);
  }

  // The house answers in the same turn, so the bot sees one gameUpdate carrying both moves (lastMove is the house's).
  private houseReply(s: RoomState) {
    if (!s.house || s.state?.status !== "active" || s.state.turn !== 1 || s.players.O !== HOUSE_SID) return;
    const move = chooseMove(getRules(s.gameId), s.state, 1, s.house, mulberry32(seed(s.roomId, s.moves)));
    if (move) this.play(s, 1, move);
  }

  // Apply a move for `slot` and update the room-level fields. False: illegal, nothing changed.
  private play(s: RoomState, slot: 0 | 1, move: unknown): boolean {
    let result;
    try {
      result = getRules(s.gameId).applyMove(s.state, move as any, slot);
    } catch {
      return false;
    }
    if (!s.moves) { s.log = []; s.first = s.state.turn; } // a room saved before replays has moves > 0 and no log: it never gets one mid-game
    s.state = result.state;
    const m = move as any;
    s.lastMove = m.type === "transfer"
      ? { type: m.type, from: m.from, to: m.to, captures: String(m.captures ?? "").split(",").filter(Boolean).map(Number) }
      : { type: m.type, cell: m.cell };
    s.lastEvents = result.events || [];
    s.lastMoveBy = slot;
    if (s.log) { if (s.log.length < LOG_MAX) s.log.push(s.lastMove); else s.log = undefined; } // past the cap the game has no replay
    if (!s.moves) {
      s.startedAt = Date.now();
      const { X, O } = s.players;
      s.rated = { id: crypto.randomUUID(), X: (X && s.botBySid[X]) || null, O: (O && s.botBySid[O]) || null, sidX: X, sidO: O };
    }
    s.moves++;
    clearOffer(s);
    return true;
  }

  // gameHandlers.js:108. The slot that moved last does not start the next game (nextStarterSlot).
  private async resetGame(ws: WebSocket, p: Msg) {
    const h = this.room(p.roomId);
    if (h?.house && h.state?.status === "active" && h.moves > 0 && this.slot(h, ws) >= 0) { // else a bot resets whenever it is losing
      ws.send(JSON.stringify({ t: "error", d: { code: "HOUSE_RESIGN", message: "resign to start over" } }));
      return;
    }
    const ran = await this.game(p, (s) => {
      const prev = s.state;
      const over = prev?.status === "win" || prev?.status === "draw";
      s.state = { ...getRules(s.gameId).createInitialState(), turn: over && prev.turn === 0 ? 1 : 0, scores: prev?.scores ? [...prev.scores] : [0, 0] };
      clearRequest(s);
      clearOffer(s);
      clearLast(s);
      s.moves = 0;
      s.startedAt = null;
      s.rated = null;
      this.houseReply(s);
    }, ws);
    if (ran) this.broadcast({ t: "gameReset", d: { roomId: this.s!.roomId } });
  }

  // A game in progress with both seats filled: the only time a resign or a draw offer means anything.
  private live(s: RoomState) {
    return s.state?.status === "active" && !!s.players.X && !!s.players.O;
  }

  // The resigning seat loses: the other slot wins and scores, as when a game ends on the board.
  private async resign(ws: WebSocket, p: Msg) {
    await this.game(p, (s) => {
      const slot = this.slot(s, ws);
      if (!this.live(s)) return;
      const scores = [s.state.scores?.[0] || 0, s.state.scores?.[1] || 0];
      scores[1 - slot]++;
      s.state = { ...s.state, status: "win", winner: 1 - slot, winningCells: [], scores };
      clearOffer(s);
    }, ws);
  }

  // Relay a fixed reaction to everyone in the room, sender and spectators included; nothing is stored.
  // Spectators, bad values and bursts drop silently.
  private emote(ws: WebSocket, p: Msg) {
    const s = this.room(p.roomId);
    const slot = s ? this.slot(s, ws) : -1;
    if (slot < 0 || typeof p.emote !== "string" || !EMOTES.includes(p.emote)) return;
    const now = Date.now();
    if (now - this.lastReact[slot] < EMOTE_GAP_MS) return;
    this.lastReact[slot] = now;
    this.broadcast({ t: "emote", d: { slot, emote: p.emote } });
  }

  // gameHandlers.js:150. Emits before the ack, as Express does.
  private async switchGame(ws: WebSocket, p: Msg) {
    const id = validateRoomId(p.roomId);
    if (!id) return { success: false, error: "Invalid room ID" };
    const gameId = validateGameId(p.gameId);
    if (!gameId) return { success: false, error: "Invalid game" };
    const s = this.room(id);
    if (!s) return { success: false, error: "Room not found" };
    if (this.slot(s, ws) < 0) return { success: false, error: "Only seated players can switch games" };
    if (s.house) return { success: false, error: "Not available against the house" };
    if (s.gameId === gameId) return { success: true, gameId };
    s.gameId = gameId;
    s.state = getRules(gameId).createInitialState();
    clearRequest(s);
    clearOffer(s);
    clearLast(s);
    s.moves = 0;
    s.startedAt = null;
    s.rated = null;
    await this.save();
    this.publish(ws);
    this.broadcast({ t: "gameReset", d: { roomId: s.roomId, gameId, reason: "gameSwitch" } });
    return { success: true, gameId };
  }

  // server/handlers/voiceHandlers.js. Express emits these without acks, so none here. Unjoined sockets
  // are ignored: they would otherwise show up in the roster and reach members.
  private async voiceSet(ws: WebSocket, p: Msg, event: string) {
    const s = this.room(p.roomId);
    if (!s || !this.att(ws).joined) return;
    const sid = this.att(ws).sid;
    const muted = Boolean(p.muted);
    s.voice[sid] = { muted };
    await this.save();
    this.others(ws, { t: event, d: { socketId: sid, muted } });
    this.publish(ws);
  }

  private async voiceLeave(ws: WebSocket, p: Msg) {
    const s = this.room(p.roomId);
    if (!s || !this.att(ws).joined || !this.dropVoice(s, this.att(ws).sid)) return;
    await this.save();
    this.publish(ws);
  }

  // Relay to exactly one live, joined socket of THIS room: the Worker is room-scoped, unlike Express
  // (socket.to(targetId) reaches any socket on the server).
  private voiceSignal(ws: WebSocket, p: Msg) {
    const s = this.room(p.roomId);
    const sid = this.att(ws).sid;
    const { targetId, data } = p;
    if (!s || !this.att(ws).joined || typeof targetId !== "string" || !targetId || targetId === sid || !data) return;
    const json = JSON.stringify(data);
    if (new TextEncoder().encode(json).length > MAX_SIGNAL_BYTES) return;
    const text = `{"t":"voice:signal","d":{"from":${JSON.stringify(sid)},"data":${json},"roomId":${JSON.stringify(s.roomId)}}}`;
    for (const w of this.ctx.getWebSockets()) {
      const a = this.att(w);
      if (a.joined && a.sid === targetId) { try { w.send(text); } catch { /* closing */ } return; }
    }
  }

  // Remove sid from voice and tell the others. True if it was in voice.
  private dropVoice(s: RoomState, sid: string): boolean {
    if (!s.voice[sid]) return false;
    delete s.voice[sid];
    this.others(sid, { t: "voice:user-left", d: { socketId: sid } });
    return true;
  }

  private free(s: RoomState, sid: string): boolean {
    let changed = false;
    for (const k of ["X", "O"] as const) if (s.players[k] === sid) { s.players[k] = null; changed = true; }
    delete s.botBySid[sid];
    if (changed && s.drawOfferer === sid) clearOffer(s); // a rejoin gets a new sid and could accept its own offer
    const n = s.spectators.length;
    s.spectators = s.spectators.filter((x) => x !== sid);
    return changed || s.spectators.length !== n;
  }

  // checkRateLimit, server/rateLimiter.js:20: fixed window, ban on the event past the max. Returns the
  // retryAfter seconds when this event must be dropped, else 0. State lives in the attachment.
  private limited(ws: WebSocket): number {
    const e = this.env as Record<string, unknown>;
    const windowMs = envInt(e.RATE_LIMIT_WINDOW_MS, 1_000, 100, 60_000);
    const max = envInt(e.RATE_LIMIT_MAX_EVENTS, 50, 10, 500);
    const banMs = envInt(e.RATE_LIMIT_BAN_DURATION_MS, 30_000, 1_000, 300_000);
    const now = Date.now();
    const att = this.att(ws);
    const rl = att.rl;
    if (rl && now < rl.until) return Math.ceil((rl.until - now) / 1000);
    const next = !rl || rl.until || now - rl.at >= windowMs ? { n: 1, at: now, until: 0 } : { ...rl, n: rl.n + 1 };
    if (next.n > max) {
      next.until = now + banMs;
      ws.serializeAttachment({ ...att, rl: next });
      return Math.ceil(banMs / 1000);
    }
    ws.serializeAttachment({ ...att, rl: next });
    return 0;
  }

  private save() {
    return this.ctx.storage.put("room", this.s);
  }

  private att(ws: WebSocket): Att {
    return (ws.deserializeAttachment() as Att | null) ?? { sid: "", joined: false };
  }

  private setJoined(ws: WebSocket, joined: boolean) {
    ws.serializeAttachment({ ...this.att(ws), joined });
  }

  // Every joined socket except the sender (socket.to(room)).
  private others(from: WebSocket | string, frame: object) {
    const sid = typeof from === "string" ? from : this.att(from).sid;
    const text = JSON.stringify(frame);
    for (const w of this.ctx.getWebSockets()) {
      const a = this.att(w);
      if (a.joined && a.sid !== sid) try { w.send(text); } catch { /* closing */ }
    }
  }

  private broadcast(frame: object) {
    const text = JSON.stringify(frame);
    for (const w of this.ctx.getWebSockets()) if (this.att(w).joined) try { w.send(text); } catch { /* closing */ }
  }

  // buildGameState + toLegacyWireState, server/roomPublisher.js:34-141. Same fields, same values.
  private publish(_ws?: WebSocket) {
    const s = this.s;
    if (!s?.created) return;
    // Voice entries of sockets that no longer exist (lost in an eviction) are removed here, so no path
    // republishes a ghost; every handler saves before publish, so the prune is saved on its own.
    const live = new Set(this.ctx.getWebSockets().map((w) => this.att(w).sid));
    const ghosts = Object.keys(s.voice).filter((k) => !live.has(k));
    for (const k of ghosts) { delete s.voice[k]; this.others("", { t: "voice:user-left", d: { socketId: k } }); }
    if (ghosts.length) void this.save();
    this.report(s);
    this.settle(s);
    const nameOf = (k: Seat) => {
      const sid = s.players[k];
      return !sid ? null : (s.names[k] ?? (sid.length > 8 ? `${sid.slice(0, 5)}…` : sid));
    };
    const rules: any = getRules(s.gameId); // JSDoc GameRules omits moveStyle
    const playerInfo = rules.playerInfo;
    const marks: string[] = playerInfo.map((p: { slot: number; label?: string }) => p.label || SLOT_TO_MARK[p.slot] || "");
    const st = s.state;
    const scores: [number, number] = [st.scores?.[0] || 0, st.scores?.[1] || 0];
    this.broadcast({
      t: "gameUpdate",
      d: {
        board: st.board,
        turn: Number.isInteger(st.turn) ? marks[st.turn] : st.turn,
        winner: st.status === "draw" ? "draw" : st.status === "win" && (st.winner === 0 || st.winner === 1) ? marks[st.winner] : null,
        winningLine: st.winningCells || [],
        xScore: scores[0],
        oScore: scores[1],
        turnSlot: Number.isInteger(st.turn) ? st.turn : null,
        winnerSlot: st.status === "win" ? st.winner : st.status === "draw" ? "draw" : null,
        scores,
        status: st.status || "active",
        winningCells: st.winningCells || [],
        playerInfo,
        marks,
        boardSpec: rules.boardSpec || null,
        moveStyle: rules.moveStyle || "place",
        lastMove: s.lastMove ?? null,
        lastEvents: s.lastEvents ?? null,
        lastMoveBy: Number.isInteger(s.lastMoveBy) ? s.lastMoveBy : null,
        newGameRequester: s.newGameRequester ?? null,
        newGameRequestedAt: s.newGameRequestedAt ?? null,
        drawOfferer: s.drawOfferer ?? null,
        roomId: s.roomId,
        gameId: s.gameId,
        roster: { X: s.players.X, O: s.players.O, XName: nameOf("X"), OName: nameOf("O"), spectators: s.spectators },
        voiceRoster: Object.fromEntries(Object.entries(s.voice).map(([k, v]) => [k, { muted: Boolean(v?.muted) }])),
      },
    });
  }
}

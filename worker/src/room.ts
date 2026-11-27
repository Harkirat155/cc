import { DurableObject } from "cloudflare:workers";
import { validateDisplayName, validateGameId, validateIndex, validateRoomId } from "./validation";
import { get as getRules } from "../../shared/games/registry.js";
import { SLOT_TO_MARK } from "../../shared/games/ttt.js";

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
}
interface Att {
  sid: string;
  joined: boolean;
  // Rate limit state of server/rateLimiter.js, per socket: events in the current window, its start, ban end.
  rl?: { n: number; at: number; until: number };
}
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
});
const clearRequest = (s: RoomState) => { s.newGameRequester = null; s.newGameRequestedAt = null; };
const clearLast = (s: RoomState) => { s.lastMove = null; s.lastEvents = null; s.lastMoveBy = null; };

export class Room extends DurableObject {
  private s: RoomState | null = null;
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
    });
  }

  // Worker calls this with a server-picked code. False means the code is taken: pick another.
  async init(roomId: string): Promise<boolean> {
    if (this.s) return false;
    this.s = fresh(roomId);
    await this.save();
    return true;
  }

  fetch(req: Request): Response {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ sid: crypto.randomUUID(), joined: false } satisfies Att);
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
    // TODO(brick 8): bind and check the seat token in joinRoom.
    // TODO(brick 11): touch/TTL alarm on every game event, as touch() does in gameHandlers.js.
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
      case "switchGame": ack(await this.switchGame(ws, data)); break;
    }
    for (const f of this.after.splice(0)) f();
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
    if (!s || !sid || !this.free(s, sid)) return;
    await this.save();
    this.publish(ws);
  }

  private async createRoom(ws: WebSocket, p: Msg) {
    const s = this.s;
    if (!s || s.created) return { error: "Unable to create room, please try again" };
    const clientId = typeof p.clientId === "string" && p.clientId ? p.clientId : null;
    const sid = this.att(ws).sid;
    s.created = true;
    s.players.X = sid;
    s.names.X = validateDisplayName(p.displayName);
    const gameId = validateGameId(p.gameId); // roomManager.js:81 falls back to ttt for an unknown id
    if (gameId && gameId !== s.gameId) { s.gameId = gameId; s.state = getRules(gameId).createInitialState(); }
    if (clientId) s.seatByClient[clientId] = "X";
    this.setJoined(ws, true);
    await this.save();
    this.after.push(() => this.publish(ws));
    return { roomId: s.roomId, player: "X" };
  }

  // server/handlers/roomHandlers.js:65-151.
  private async joinRoom(ws: WebSocket, p: Msg) {
    if (!validateRoomId(p.roomId)) return { error: "Invalid room ID" };
    const s = this.s;
    if (!s?.created || s.roomId !== validateRoomId(p.roomId)) return { error: "Room not found" };
    const sid = this.att(ws).sid;
    // A seat held by a sid with no live socket is stale (eviction can close sockets without a close event).
    const live = new Set(this.ctx.getWebSockets().map((w) => this.att(w).sid));
    for (const k of ["X", "O"] as const) if (s.players[k] && !live.has(s.players[k]!)) s.players[k] = null;
    s.spectators = s.spectators.filter((x) => live.has(x));
    const clientId = typeof p.clientId === "string" && p.clientId ? p.clientId : null;
    const name = validateDisplayName(p.displayName);
    let role: Seat | "spectator" | null = null;

    // 1) rebind by clientId
    const mapped = clientId ? s.seatByClient[clientId] : undefined;
    if (mapped === "X" || mapped === "O") {
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
    // 3) open seat. A clientId that owns a seat is never given the other one.
    if (!role) {
      // A clientId that already owns a seat (held by a live socket, so rebind skipped it) never gets the other one.
      // Express would double-seat here (roomHandlers.js:121 has the guard only on the O branch); this is deliberately safer.
      if (mapped) {
        role = "spectator";
      } else if (!s.players.X) {
        s.players.X = sid; role = "X"; if (clientId) s.seatByClient[clientId] = "X"; s.names.X = name;
      } else if (!s.players.O) {
        s.players.O = sid; role = "O"; if (clientId) s.seatByClient[clientId] = "O"; s.names.O = name;
      } else {
        role = "spectator";
      }
    }
    if (role === "spectator") {
      if (!s.spectators.includes(sid)) s.spectators.push(sid);
    } else {
      s.spectators = s.spectators.filter((x) => x !== sid);
    }
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
    const changed = this.free(s, this.att(ws).sid);
    const hadSeat = !!clientId && clientId in s.seatByClient;
    if (clientId) delete s.seatByClient[clientId];
    if (!changed) {
      if (hadSeat) await this.save(); // the reservation delete must survive hibernation
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
    if (!move) return;
    let result;
    try {
      result = getRules(s.gameId).applyMove(s.state, move as any, slot);
    } catch {
      return;
    }
    s.state = result.state;
    s.lastMove = move;
    s.lastEvents = result.events || [];
    s.lastMoveBy = slot;
    await this.save();
    this.publish(ws);
  }

  // gameHandlers.js:108. The slot that moved last does not start the next game (nextStarterSlot).
  private async resetGame(ws: WebSocket, p: Msg) {
    const ran = await this.game(p, (s) => {
      const prev = s.state;
      const over = prev?.status === "win" || prev?.status === "draw";
      s.state = { ...getRules(s.gameId).createInitialState(), turn: over && prev.turn === 0 ? 1 : 0, scores: prev?.scores ? [...prev.scores] : [0, 0] };
      clearRequest(s);
      clearLast(s);
    }, ws);
    if (ran) this.broadcast({ t: "gameReset", d: { roomId: this.s!.roomId } });
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
    if (s.gameId === gameId) return { success: true, gameId };
    s.gameId = gameId;
    s.state = getRules(gameId).createInitialState();
    clearRequest(s);
    clearLast(s);
    await this.save();
    this.publish(ws);
    this.broadcast({ t: "gameReset", d: { roomId: s.roomId, gameId, reason: "gameSwitch" } });
    return { success: true, gameId };
  }

  private free(s: RoomState, sid: string): boolean {
    let changed = false;
    for (const k of ["X", "O"] as const) if (s.players[k] === sid) { s.players[k] = null; changed = true; }
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

  private broadcast(frame: object) {
    const text = JSON.stringify(frame);
    for (const w of this.ctx.getWebSockets()) if (this.att(w).joined) try { w.send(text); } catch { /* closing */ }
  }

  // buildGameState + toLegacyWireState, server/roomPublisher.js:34-141. Same fields, same values.
  private publish(_ws: WebSocket) {
    const s = this.s;
    if (!s?.created) return;
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
        roomId: s.roomId,
        gameId: s.gameId,
        roster: { X: s.players.X, O: s.players.O, XName: nameOf("X"), OName: nameOf("O"), spectators: s.spectators },
        voiceRoster: {}, // TODO(brick 9): voice roster
      },
    });
  }
}

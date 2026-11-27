import { DurableObject } from "cloudflare:workers";
import { validateDisplayName, validateRoomId } from "./validation";

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
}
interface Att {
  sid: string;
  joined: boolean;
}
type Msg = Record<string, unknown>;

const fresh = (roomId: string): RoomState => ({
  roomId,
  created: false,
  gameId: "ttt",
  players: { X: null, O: null },
  spectators: [],
  seatByClient: {},
  names: { X: null, O: null },
});

export class Room extends DurableObject {
  private s: RoomState | null = null;
  private after: (() => void)[] = []; // broadcasts that follow the ack, as io emits after ack() in roomHandlers.js

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get<RoomState>("room")) ?? null;
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
    // TODO(brick 7): per-connection rate limit. TODO(brick 8): bind and check the seat token in joinRoom.
    switch (t) {
      case "createRoom": ack(await this.createRoom(ws, data)); break;
      case "joinRoom": ack(await this.joinRoom(ws, data)); break;
      case "updateDisplayName": await this.updateName(ws, data); break;
      case "leaveRoom": ack(await this.leaveRoom(ws, data)); break;
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
    if (typeof p.gameId === "string") s.gameId = p.gameId; // TODO(brick 6): validate against the game registry
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

  private free(s: RoomState, sid: string): boolean {
    let changed = false;
    for (const k of ["X", "O"] as const) if (s.players[k] === sid) { s.players[k] = null; changed = true; }
    const n = s.spectators.length;
    s.spectators = s.spectators.filter((x) => x !== sid);
    return changed || s.spectators.length !== n;
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

  // roster as buildGameState, server/roomPublisher.js:84-91. TODO(brick 6): merge the game state fields.
  private publish(_ws: WebSocket) {
    const s = this.s;
    if (!s?.created) return;
    const nameOf = (k: Seat) => {
      const sid = s.players[k];
      return !sid ? null : (s.names[k] ?? (sid.length > 8 ? `${sid.slice(0, 5)}…` : sid));
    };
    this.broadcast({
      t: "gameUpdate",
      d: {
        roomId: s.roomId,
        gameId: s.gameId,
        roster: { X: s.players.X, O: s.players.O, XName: nameOf("X"), OName: nameOf("O"), spectators: s.spectators },
        voiceRoster: {},
      },
    });
  }
}

import { DurableObject } from "cloudflare:workers";
import { genCode, validateGameId } from "./validation";
import { buildEntry, MAX_ENTRIES, type FeedbackEntry, type FeedbackInput } from "./feedbackStore";

type Msg = Record<string, unknown>;
interface Att { sid: string }
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

import { DurableObject } from "cloudflare:workers";
import { validateGameId } from "./validation";
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

  // Debounced lobbyUpdate (broadcastLobbyState, lobbyManager.js:187): the first change arms a
  // LOBBY_MATCH_DEBOUNCE_MS alarm, later changes inside the window ride on it.
  private async touched() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + 100);
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
    server.serializeAttachment({ sid: crypto.randomUUID() } satisfies Att);
    return new Response(null, { status: 101, webSocket: client });
  }
}

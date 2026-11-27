import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { Client, open } from "./helpers";
import type { Room } from "../src/room";

const rooms = () => (env as unknown as { ROOM: DurableObjectNamespace<Room> }).ROOM;

async function newRoom(clientId?: string, displayName?: string) {
  const a = await open("/ws/room/new");
  const ack = await a.call("createRoom", { clientId, displayName });
  return { a, ack };
}

describe("Room create/join/leave", () => {
  it("sends hello with the socket's sid first, and that sid is the roster id", async () => {
    const a = await open("/ws/room/new");
    const ack = await a.call("createRoom", { clientId: "h1", displayName: "Alice" });
    expect(a.frames[0]).toEqual({ t: "hello", d: { sid: expect.any(String) } });
    const u = await a.update();
    expect(u.roster.X).toBe(a.frames[0].d.sid);
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "h2", displayName: "Bob" });
    expect(b.frames[0].t).toBe("hello");
    expect(b.frames[0].d.sid).not.toBe(a.frames[0].d.sid);
    expect((await b.update()).roster.O).toBe(b.frames[0].d.sid);
  });

  it("creates, joins, broadcasts, and updates after leave", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    expect(ack.player).toBe("X");
    expect(ack.roomId).toMatch(/^[A-Z0-9]{5}$/);
    const u1 = await a.update();
    expect(u1.roster).toMatchObject({ XName: "Alice", O: null, spectators: [] });
    expect(u1.roomId).toBe(ack.roomId);

    const b = await open(`/ws/room/${ack.roomId.toLowerCase()}`);
    expect(await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" })).toEqual({ player: "O" });
    const ub = await b.update();
    expect(ub.roster).toMatchObject({ XName: "Alice", OName: "Bob" });
    expect((await a.wait((f) => f.t === "startGame")).d).toBeUndefined();
    const afterJoin = a.frames.length;

    expect(await b.call("leaveRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ ok: true });
    const ua = (await a.wait((f) => f.t === "gameUpdate" && f.d.roster.O === null, afterJoin)).d;
    expect(ua.roster.XName).toBe("Alice");
    expect(await b.call("leaveRoom", { roomId: ack.roomId })).toEqual({ error: "Not in room" });
  });

  it("returns the Socket.IO error acks", async () => {
    const a = await open("/ws/room/ZZZZZ");
    expect(await a.call("joinRoom", { roomId: "bad" })).toEqual({ error: "Invalid room ID" });
    expect(await a.call("joinRoom", { roomId: "ZZZZZ" })).toEqual({ error: "Room not found" });
    expect(await a.call("leaveRoom", { roomId: "ZZZZZ" })).toEqual({ error: "Room not found" });
    expect(await a.call("createRoom", {})).toEqual({ error: "Unable to create room, please try again" });
  });

  it("seats a third socket as spectator and ignores junk frames", async () => {
    const { a, ack } = await newRoom();
    const b = await open(`/ws/room/${ack.roomId}`);
    const c = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId });
    expect(await c.call("joinRoom", { roomId: ack.roomId })).toEqual({ player: "spectator" });
    a.ws.send("not json");
    a.ws.send(JSON.stringify({ t: "nope", id: 9 }));
    a.ws.send(new Uint8Array([1]));
    expect(await a.call("leaveRoom", { roomId: ack.roomId })).toEqual({ ok: true });
  });

  it("refuses a non-upgrade request", async () => {
    const r = await app.fetch(new Request("http://x/ws/room/new"), env);
    expect(r.status).toBe(426);
  });
});

describe("display names", () => {
  it("trims to 20, needs 2 chars, and only seated sockets may rename", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: `  ${"n".repeat(30)}  ` });
    const u = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.XName.startsWith("nnn"), 0)).d;
    expect(u.roster.XName).toBe("n".repeat(20));

    const n = b.frames.length;
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: "x" });
    const c = await open(`/ws/room/${ack.roomId}`);
    await c.call("joinRoom", { roomId: ack.roomId }); // spectator
    c.send("updateDisplayName", { roomId: ack.roomId, displayName: "Spectator" });
    // flush: a later valid rename arrives after the two ignored ones
    b.send("updateDisplayName", { roomId: ack.roomId, displayName: "Bobby" });
    await a.wait((f) => f.t === "gameUpdate" && f.d.roster.OName === "Bobby");
    const names = b.frames.slice(n).filter((f) => f.t === "gameUpdate").map((f) => f.d.roster.XName);
    expect(names.every((x: string) => x === "n".repeat(20))).toBe(true);
  });
});

describe("seat rebind (server/socketHandlers.test.js:36)", () => {
  it("same clientId cannot hold X and O when the first socket is still live", async () => {
    const { ack } = await newRoom("client-1");
    const b = await open(`/ws/room/${ack.roomId}`);
    const joined = await b.call("joinRoom", { roomId: ack.roomId, clientId: "client-1" });
    expect(["X", "spectator"]).toContain(joined.player);
    const u = await b.update();
    expect(u.roster.X).not.toBe(u.roster.O);
    expect(u.roster.O).toBeNull();
  });

  it("a reconnect after the old socket closed takes back the same seat", async () => {
    const { a, ack } = await newRoom("c1");
    const o = await open(`/ws/room/${ack.roomId}`);
    await o.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    a.close();
    await o.wait((f) => f.t === "gameUpdate" && f.d.roster.X === null);
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect(await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ player: "X" });
  });

  it("a clientId that owns O is not also given a vacated X by a second socket", async () => {
    const { a, ack } = await newRoom("c1");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    await a.call("leaveRoom", { roomId: ack.roomId }); // X is now empty, c2 still owns O on a live socket
    const b2 = await open(`/ws/room/${ack.roomId}`);
    expect(await b2.call("joinRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ player: "spectator" });
    const stored = await runInDurableObject(rooms().getByName(ack.roomId), async (_o, state) => state.storage.get<any>("room"));
    expect(stored.seatByClient.c2).toBe("O");
  });

  it("explicit leave frees the clientId reservation", async () => {
    const { a, ack } = await newRoom("c1");
    await a.call("leaveRoom", { roomId: ack.roomId, clientId: "c1" });
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect((await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).player).toBe("X");
  });
});

describe("persistence", () => {
  it("a leaveRoom that only deletes a clientId reservation is saved across eviction", async () => {
    const { a, ack } = await newRoom("c1");
    const stub = rooms().getByName(ack.roomId);
    a.close();
    for (let i = 0; i < 100; i++) {
      const st = await runInDurableObject(stub, async (_o, state) => state.storage.get<any>("room"));
      if (!st.players.X) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const x = await open(`/ws/room/${ack.roomId}`);
    expect(await x.call("leaveRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ error: "Not in room" });
    await evictDurableObject(stub, { webSockets: "hibernate" });
    const stored = await runInDurableObject(stub, async (_o, state) => state.storage.get<any>("room"));
    expect(stored.seatByClient.c1).toBeUndefined();
  });

  it("keeps seats and names in storage", async () => {
    const { ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" });
    const stored = await runInDurableObject(rooms().getByName(ack.roomId), async (_o, state) => state.storage.get<any>("room"));
    expect(stored).toMatchObject({ created: true, seatByClient: { c1: "X", c2: "O" }, names: { X: "Alice", O: "Bob" } });
    expect(stored.players.X).toBeTruthy();
    expect(stored.players.O).toBeTruthy();
  });

  // evictDurableObject (webSockets: "hibernate") tears the instance down and keeps the sockets open,
  // as workerd does on hibernation. The next frame runs a new constructor over stored state, with
  // sids restored from socket attachments.
  it("survives eviction with live sockets: same seats, same sids, broadcasts still reach both", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" });
    const before = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.O)).d.roster;

    await evictDurableObject(rooms().getByName(ack.roomId), { webSockets: "hibernate" });

    const n = b.frames.length;
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: "Alicia" });
    const after = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.XName === "Alicia", n)).d.roster;
    expect(after).toMatchObject({ X: before.X, O: before.O, OName: "Bob" });
    expect(await b.call("leaveRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ ok: true });
  });

  it("rebinds a reconnecting clientId after eviction closed every socket", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    await evictDurableObject(rooms().getByName(ack.roomId), { webSockets: "close" });
    void a;
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect(await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ player: "X" });
    expect((await a2.update()).roster.XName).toBe("Alice");
  });
});

// Cases ported from server/handlers/gameHandlers.test.js. Express drops illegal input silently, so
// "rejected" here means no gameUpdate follows and the stored game is unchanged.
async function pair() {
  const { a, ack } = await newRoom("c1", "Alice");
  const b = await open(`/ws/room/${ack.roomId}`);
  await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" });
  const roomId: string = ack.roomId;
  const mv = (c: Client, index: number) => c.send("makeMove", { roomId, index });
  const latest = async (pred: (d: any) => boolean = () => true) => (await a.wait((f) => f.t === "gameUpdate" && pred(f.d), 0)).d;
  const stored = () => runInDurableObject(rooms().getByName(roomId), async (_o, st) => st.storage.get<any>("room"));
  return { a, b, roomId, mv, latest, stored };
}
const XWINS = [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]; // [player, cell]: X takes the top row

describe("game: makeMove", () => {
  it("places a mark and publishes the legacy wire shape", async () => {
    const { a, b, roomId, mv } = await pair();
    mv(a, 4);
    const w = (await b.wait((f) => f.t === "gameUpdate" && f.d.board?.[4] === "X")).d;
    expect(w).toMatchObject({ turn: "O", winner: null, winningLine: [], xScore: 0, oScore: 0, gameId: "ttt", roomId, turnSlot: 1, scores: [0, 0], status: "active", moveStyle: "place", newGameRequester: null, lastMove: { type: "place", cell: 4 }, lastMoveBy: 0 });
    expect(w.boardSpec).toMatchObject({ kind: "grid", rows: 3, cols: 3 });
    expect(w.marks).toEqual(["X", "O"]);
    expect(w.roster).toMatchObject({ XName: "Alice", OName: "Bob" });
  });

  it("broadcasts and stores only a move's own fields as lastMove", async () => {
    const { a, b, roomId, stored } = await pair();
    a.send("makeMove", { roomId, move: { type: "place", cell: 4, junk: "x".repeat(1000) } });
    const w = (await b.wait((f) => f.t === "gameUpdate" && f.d.board?.[4] === "X")).d;
    expect(w.lastMove).toEqual({ type: "place", cell: 4 });
    expect((await stored()).lastMove).toEqual({ type: "place", cell: 4 });
  });

  it("silently drops a wrong-turn move, a spectator move and an occupied cell", async () => {
    const { a, b, roomId, mv, stored } = await pair();
    const s = await open(`/ws/room/${roomId}`);
    expect(await s.call("joinRoom", { roomId })).toEqual({ player: "spectator" });
    mv(b, 0); // O moves first: wrong turn
    mv(s, 0); // spectator
    mv(a, 4);
    mv(b, 4); // occupied
    mv(a, 9); // out of range
    a.send("makeMove", { roomId, index: "4" });
    a.send("makeMove", { roomId: "bad", index: 0 });
    mv(b, 0); // the one legal reply, a flush marker
    await a.wait((f) => f.t === "gameUpdate" && f.d.board[0] === "O");
    const marks = a.frames.filter((f) => f.t === "gameUpdate").map((f) => f.d.board.filter(Boolean).length);
    expect(marks.filter((n: number) => n > 0)).toEqual([1, 2]); // only the two legal moves published
    expect((await stored()).state.board).toEqual(["O", "", "", "", "X", "", "", "", ""]);
    expect(a.frames.some((f) => f.t === "error")).toBe(false);
  });

  it("scores a win and reports the winning line", async () => {
    const { a, b, mv, latest } = await pair();
    for (const [p, c] of XWINS) mv(p ? b : a, c);
    const w = await latest((d) => d.winner);
    expect(w).toMatchObject({ winner: "X", winningLine: [0, 1, 2], xScore: 1, oScore: 0, status: "win", winnerSlot: 0, scores: [1, 0], winningCells: [0, 1, 2] });
  });

  it("reports a draw as winner 'draw' with no score", async () => {
    const { a, b, mv, latest } = await pair();
    for (const [p, c] of [[0, 0], [1, 1], [0, 2], [1, 4], [0, 3], [1, 5], [0, 7], [1, 6], [0, 8]]) mv(p ? b : a, c);
    expect(await latest((d) => d.winner === "draw")).toMatchObject({ xScore: 0, oScore: 0, status: "draw", winnerSlot: "draw" });
  });
});

describe("game: reset, scores, new-game requests", () => {
  it("resetGame lets the loser start, keeps scores, clears the request, then sends gameReset", async () => {
    const { a, b, roomId, mv, latest } = await pair();
    for (const [p, c] of XWINS) mv(p ? b : a, c);
    await latest((d) => d.winner);
    b.send("requestNewGame", { roomId });
    await a.wait((f) => f.t === "gameUpdate" && !!f.d.newGameRequester);
    const n = a.frames.length;
    a.send("resetGame", { roomId });
    const reset = await a.wait((f) => f.t === "gameReset", n);
    expect(reset.d).toEqual({ roomId });
    const tail = a.frames.slice(n).map((f) => f.t);
    expect(tail.indexOf("gameUpdate")).toBeLessThan(tail.indexOf("gameReset"));
    const w = a.frames.slice(n).find((f) => f.t === "gameUpdate")!.d;
    expect(w).toMatchObject({ board: Array(9).fill(""), turn: "O", turnSlot: 1, xScore: 1, oScore: 0, newGameRequester: null, newGameRequestedAt: null, lastMove: null, lastEvents: null, lastMoveBy: null });
  });

  it("resetScores zeroes scores without touching the board", async () => {
    const { a, roomId, mv, latest } = await pair();
    mv(a, 0);
    await latest((d) => d.board[0] === "X");
    a.send("resetScores", { roomId });
    expect(await latest((d) => d.board[0] === "X" && d.scores[0] === 0)).toMatchObject({ scores: [0, 0] });
  });

  // Deliberately stricter than Express, which lets any socket in the room run these four.
  it("ignores resetGame, resetScores and new-game requests from a spectator", async () => {
    const { a, b, roomId, mv, stored } = await pair();
    const s = await open(`/ws/room/${roomId}`);
    expect(await s.call("joinRoom", { roomId })).toEqual({ player: "spectator" });
    for (const [p, c] of XWINS) mv(p ? b : a, c);
    await a.wait((f) => f.t === "gameUpdate" && f.d.winner === "X");
    const n = a.frames.length;
    s.send("resetScores", { roomId });
    s.send("resetGame", { roomId });
    s.send("requestNewGame", { roomId });
    s.send("cancelNewGameRequest", { roomId });
    a.send("updateDisplayName", { roomId, displayName: "Al" }); // flush marker
    await a.wait((f) => f.t === "gameUpdate" && f.d.roster.XName === "Al", n);
    const tail = a.frames.slice(n);
    expect(tail.filter((f) => f.t === "gameUpdate")).toHaveLength(1);
    expect(tail.some((f) => f.t === "gameReset")).toBe(false);
    const st = await stored();
    expect(st.state.scores).toEqual([1, 0]);
    expect(st.state.board.slice(0, 3)).toEqual(["X", "X", "X"]);
    expect(st.newGameRequester).toBeNull();
  });

  it("requestNewGame and cancel ride on gameUpdate", async () => {
    const { a, b, roomId, stored } = await pair();
    b.send("requestNewGame", { roomId });
    const sid = (await stored()).players.O;
    const req = (await a.wait((f) => f.t === "gameUpdate" && !!f.d.newGameRequester)).d;
    expect(req.newGameRequester).toBe(sid);
    expect(typeof req.newGameRequestedAt).toBe("number");
    b.send("cancelNewGameRequest", { roomId });
    const n = a.frames.length;
    expect((await a.wait((f) => f.t === "gameUpdate" && f.d.newGameRequester === null, n)).d.newGameRequestedAt).toBeNull();
  });
});

describe("game: resign, draw offers, emotes", () => {
  const flush = async (c: Client, roomId: string, watch = c) => {
    const n = watch.frames.length;
    c.send("updateDisplayName", { roomId, displayName: `F${n}` });
    await watch.wait((f) => f.t === "gameUpdate" && (f.d.roster.XName === `F${n}` || f.d.roster.OName === `F${n}`), n);
    return n;
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("resign gives the opponent the win and the score", async () => {
    const { a, b, roomId } = await pair();
    b.send("resign", { roomId });
    const d = (await a.wait((f) => f.t === "gameUpdate" && f.d.status === "win")).d;
    expect(d).toMatchObject({ winner: "X", winnerSlot: 0, scores: [1, 0], xScore: 1, oScore: 0 });
  });

  it("ignores resign from a spectator and after the game ends", async () => {
    const { a, b, roomId, mv, stored } = await pair();
    const s = await open(`/ws/room/${roomId}`);
    await s.call("joinRoom", { roomId });
    s.send("resign", { roomId });
    await flush(a, roomId);
    expect((await stored()).state.status).toBe("active");
    for (const [p, c] of XWINS) mv(p ? b : a, c);
    await a.wait((f) => f.t === "gameUpdate" && f.d.winner === "X");
    b.send("resign", { roomId });
    a.send("resign", { roomId });
    await flush(a, roomId);
    expect((await stored()).state).toMatchObject({ status: "win", winner: 0, scores: [1, 0] });
  });

  it("offers, accepts and declines a draw", async () => {
    const { a, b, roomId, stored } = await pair();
    a.send("offerDraw", { roomId });
    const sid = (await stored()).players.X;
    expect((await b.wait((f) => f.t === "gameUpdate" && !!f.d.drawOfferer)).d.drawOfferer).toBe(sid);
    a.send("acceptDraw", { roomId }); // the offerer cannot accept their own offer
    await flush(a, roomId);
    expect((await stored()).state.status).toBe("active");
    b.send("declineDraw", { roomId });
    expect((await a.wait((f) => f.t === "gameUpdate" && f.d.drawOfferer === null && f.d.status === "active", 0)).d.status).toBe("active");
    const m = a.frames.length;
    b.send("offerDraw", { roomId });
    await a.wait((f) => f.t === "gameUpdate" && !!f.d.drawOfferer, m);
    a.send("acceptDraw", { roomId });
    const d = (await b.wait((f) => f.t === "gameUpdate" && f.d.status === "draw")).d;
    expect(d).toMatchObject({ winner: "draw", winnerSlot: "draw", scores: [0, 0], drawOfferer: null });
  });

  it("the offerer can cancel an offer, and a move clears it", async () => {
    const { a, b, roomId, mv } = await pair();
    a.send("offerDraw", { roomId });
    await b.wait((f) => f.t === "gameUpdate" && !!f.d.drawOfferer);
    a.send("cancelDrawOffer", { roomId });
    await b.wait((f) => f.t === "gameUpdate" && f.d.drawOfferer === null, 0);
    const m = a.frames.length;
    b.send("offerDraw", { roomId });
    await a.wait((f) => f.t === "gameUpdate" && !!f.d.drawOfferer, m);
    const n = a.frames.length;
    mv(a, 0);
    const d = (await a.wait((f) => f.t === "gameUpdate" && f.d.board[0] === "X", n)).d;
    expect(d.drawOfferer).toBeNull();
  });

  it("relays an emote to the opponent only, with the sender's slot", async () => {
    const { a, b, roomId } = await pair();
    b.send("emote", { roomId, emote: "🔥" });
    const f = await a.wait((x) => x.t === "emote");
    expect(f.d).toEqual({ slot: 1, emote: "🔥" });
    await flush(a, roomId, b);
    expect(b.frames.some((x) => x.t === "emote")).toBe(false);
  });

  it("drops a bad emote and rate-limits to 1 per second per player", async () => {
    const { a, b, roomId } = await pair();
    for (const bad of ["hi", "👍👍", 5, null]) b.send("emote", { roomId, emote: bad });
    b.send("emote", { roomId, emote: "👍" });
    b.send("emote", { roomId, emote: "👏" }); // within 1 s: dropped
    await flush(b, roomId, a);
    expect(a.frames.filter((x) => x.t === "emote").map((x) => x.d.emote)).toEqual(["👍"]);
    await sleep(1050);
    b.send("emote", { roomId, emote: "😮" });
    await a.wait((x) => x.t === "emote" && x.d.emote === "😮");
  });
});

describe("game: switchGame", () => {
  it("lets a seated player switch, resets state, emits gameUpdate then gameReset, then acks", async () => {
    const { a, b, roomId, mv, latest } = await pair();
    for (const [p, c] of XWINS) mv(p ? b : a, c);
    await latest((d) => d.winner);
    const n = a.frames.length;
    expect(await a.call("switchGame", { roomId, gameId: " Connect4 " })).toEqual({ success: true, gameId: "connect4" });
    const tail = a.frames.slice(n);
    expect(tail.map((f) => f.t)).toEqual(["gameUpdate", "gameReset", "ack"]);
    expect(tail[1].d).toEqual({ roomId, gameId: "connect4", reason: "gameSwitch" });
    expect(tail[0].d).toMatchObject({ gameId: "connect4", scores: [0, 0], xScore: 0, newGameRequester: null, lastMove: null });
    expect(tail[0].d.board).toHaveLength(42);
    expect(tail[0].d.boardSpec).toMatchObject({ rows: 6, cols: 7 });
  });

  it("returns the Socket.IO error acks and leaves the room alone", async () => {
    const { a, roomId, stored } = await pair();
    const s = await open(`/ws/room/${roomId}`);
    await s.call("joinRoom", { roomId });
    expect(await s.call("switchGame", { roomId, gameId: "checkers" })).toEqual({ success: false, error: "Only seated players can switch games" });
    expect(await a.call("switchGame", { roomId, gameId: "missing-game" })).toEqual({ success: false, error: "Invalid game" });
    expect(await a.call("switchGame", { roomId: "bad", gameId: "checkers" })).toEqual({ success: false, error: "Invalid room ID" });
    expect(await a.call("switchGame", { roomId: "ABCDE", gameId: "checkers" })).toEqual({ success: false, error: "Room not found" });
    expect(await a.call("switchGame", { roomId, gameId: "ttt" })).toEqual({ success: true, gameId: "ttt" });
    expect((await stored()).gameId).toBe("ttt");
  });

  it("falls back to ttt for an unregistered gameId on createRoom, as Express does", async () => {
    const a = await open("/ws/room/new");
    const ack = await a.call("createRoom", { gameId: "nope" });
    expect((await a.update()).gameId).toBe("ttt");
    const b = await open("/ws/room/new");
    await b.call("createRoom", { gameId: "connect4" });
    expect((await b.update()).boardSpec).toMatchObject({ rows: 6 });
    void ack;
  });
});

describe("game: hibernation", () => {
  it("keeps board, turn and scores across eviction", async () => {
    const { a, b, roomId, mv, latest } = await pair();
    mv(a, 0);
    mv(b, 3);
    await latest((d) => d.board[3] === "O");
    await evictDurableObject(rooms().getByName(roomId), { webSockets: "hibernate" });
    mv(a, 1);
    const w = await latest((d) => d.board[1] === "X");
    expect(w.board).toEqual(["X", "X", "", "O", "", "", "", "", ""]);
    expect(w).toMatchObject({ turn: "O", turnSlot: 1, lastMoveBy: 0 });
  });

  // Brick 5 stored createRoom's gameId unvalidated and no game state (c69e01d room.ts:109).
  it.each([
    ["connect4", "connect4", 42],
    ["nope", "ttt", 9],
  ])("wakes a pre-brick-6 room stored with gameId %s as %s with a %i-cell board", async (stored, gameId, cells) => {
    const { a, ack } = await newRoom("c1");
    const stub = rooms().getByName(ack.roomId);
    await runInDurableObject(stub, async (_o, state) => {
      const room = await state.storage.get<any>("room");
      delete room.state;
      room.gameId = stored;
      await state.storage.put("room", room);
    });
    await evictDurableObject(stub, { webSockets: "hibernate" });
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    const w = await b.update();
    expect(w.gameId).toBe(gameId);
    expect(w.board).toHaveLength(cells);
    a.close();
  });
});

// server/rateLimiter.js: 50 events per 1 s window per socket, then a ban. The test config sets a 1 s ban.
describe("rate limit", () => {
  // Window 1 s, max 50, ban 2 s (vitest.config.ts). The probe is a switchGame with an invalid room id: it is
  // acked with an error body and touches no state, so an ack proves the frame got past the limiter.
  let ids = 0;
  const probe = (c: Client) => {
    const id = ++ids;
    c.ws.send(JSON.stringify({ t: "switchGame", id, d: { roomId: "bad" } }));
    return id;
  };
  const acked = (c: Client, id: number) => c.frames.some((f) => f.t === "ack" && f.id === id);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const burst = async (c: Client, count: number) => {
    let last = 0;
    for (let i = 0; i < count; i++) last = probe(c);
    await c.wait((f) => f.t === "ack" && f.id === last);
  };
  const limitedFrame = (c: Client, from: number) => c.wait((f) => f.t === "error" && f.d?.code === "RATE_LIMITED", from);
  const errors = (c: Client) => c.frames.filter((f) => f.t === "error");

  it("acks frames 1-50, bans on the 51st with retryAfter 2, counts down, and lifts the ban", async () => {
    const a = await open("/ws/room/ZZZZZ");
    await burst(a, 50);
    expect(a.frames.filter((f) => f.t === "ack")).toHaveLength(50);
    expect(errors(a)).toHaveLength(0);

    const n = a.frames.length;
    const id51 = probe(a);
    const err = await limitedFrame(a, n);
    expect(err.d).toEqual({ code: "RATE_LIMITED", message: "Too many requests. Retry after 2s", retryAfter: 2 });
    expect(acked(a, id51)).toBe(false);

    await sleep(1100);
    const m = a.frames.length;
    const idLate = probe(a);
    expect((await limitedFrame(a, m)).d.retryAfter).toBe(1);
    expect(acked(a, idLate)).toBe(false);

    await sleep(1000); // ban over (2 s after the trigger)
    const idOk = probe(a);
    await a.wait((f) => f.t === "ack" && f.id === idOk);
    expect(errors(a)).toHaveLength(2);
  }, 10_000);

  it("drops a banned move, spares the neighbour socket", async () => {
    const { a, b, roomId, mv, stored } = await pair();
    await burst(a, 49); // pair() already spent one frame on a (createRoom): 50 counted
    const n = a.frames.length;
    mv(a, 4); // 51st frame: banned, and must not be played
    await limitedFrame(a, n);
    a.ws.send(JSON.stringify({ t: "switchGame", id: 9999, d: { roomId, gameId: "ttt" } }));

    const m = b.frames.length;
    b.send("updateDisplayName", { roomId, displayName: "Bobby" }); // flush marker: the DO has handled a's frames
    expect((await b.update(m)).roster.OName).toBe("Bobby");
    expect(errors(b)).toHaveLength(0);
    expect((await stored()).state.board).toEqual(Array(9).fill(""));
    expect(acked(a, 9999)).toBe(false);

    await sleep(2100);
    mv(a, 4);
    await a.wait((f) => f.t === "gameUpdate" && f.d.board[4] === "X", n);
  }, 10_000);

  it("resets the count each window: 50 frames, a pause, 50 more, no ban", async () => {
    const a = await open("/ws/room/ZZZZZ");
    await burst(a, 50);
    await sleep(1100);
    await burst(a, 50);
    expect(a.frames.filter((f) => f.t === "ack")).toHaveLength(100);
    expect(errors(a)).toHaveLength(0);
  }, 10_000);

  it("keeps the ban across hibernation", async () => {
    const a = await open("/ws/room/ZZZZZ");
    await burst(a, 50);
    const n = a.frames.length;
    probe(a);
    await limitedFrame(a, n);

    await evictDurableObject(rooms().getByName("ZZZZZ"), { webSockets: "hibernate" });

    const m = a.frames.length;
    const id = probe(a);
    expect((await limitedFrame(a, m)).d.retryAfter).toBeGreaterThanOrEqual(1);
    expect(acked(a, id)).toBe(false);

    await sleep(2100);
    const ok = probe(a);
    await a.wait((f) => f.t === "ack" && f.id === ok);
  }, 10_000);

  it("counts frames that are not JSON, as Express counts every event", async () => {
    const { a } = await pair();
    const n = a.frames.length;
    for (let i = 0; i < 60; i++) a.ws.send("not json");
    expect((await a.wait((f) => f.t === "error", n)).d.code).toBe("RATE_LIMITED");
  });
});

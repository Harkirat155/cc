import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { open } from "./helpers";
import type { Lobby } from "../src/lobby";
import type { Room } from "../src/room";

const lobby = () => (env as unknown as { LOBBY: DurableObjectNamespace<Lobby> }).LOBBY.getByName("lobby");
const clear = () => runInDurableObject(lobby(), async (_o, st) => { st.storage.sql.exec("DELETE FROM queue"); });
const lobbyOf = () => open("/ws/lobby");

describe("Lobby queue (server/lobbyManager.test.js)", () => {
  it("sends hello with the socket's sid as the first frame, and the queue lists that sid", async () => {
    await clear();
    const a = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    expect(a.frames[0]).toEqual({ t: "hello", d: { sid: expect.any(String) } });
    expect((await a.call("getLobbyState")).queue[0].socketId).toBe(a.frames[0].d.sid);
  });

  it("validates the display name and defaults the game", async () => {
    await clear();
    const a = await lobbyOf();
    expect(await a.call("joinLobby", { displayName: "A" })).toEqual({ success: false, error: "Display name must be at least 2 characters" });
    expect(await a.call("joinLobby", { displayName: "x".repeat(21) })).toEqual({ success: false, error: "Display name must be 20 characters or less" });
    expect(await a.call("joinLobby", { displayName: "  Alice  ", gameId: "nope" })).toEqual({ success: true, position: 0 });
    expect((await a.call("getLobbyState")).queue).toMatchObject([{ displayName: "Alice", gameId: "ttt" }]);
  });

  it("rejects a second join, and leave removes", async () => {
    await clear();
    const a = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    expect(await a.call("joinLobby", { displayName: "Alice" })).toEqual({ success: false, error: "Already in lobby" });
    expect(await a.call("leaveLobby")).toEqual({ success: true });
    expect(await a.call("leaveLobby")).toEqual({ success: false, error: "Not in lobby" });
    expect((await a.call("getLobbyState")).queue).toEqual([]);
  });

  it("enforces the queue cap", async () => {
    await clear();
    await runInDurableObject(lobby(), async (o: Lobby) => { for (let i = 0; i < 100; i++) o.enqueue(`s${i}`, `Player${i}`, "ttt"); });
    const a = await lobbyOf();
    expect(await a.call("joinLobby", { displayName: "Late" })).toEqual({ success: false, error: "Matchmaking queue is full, please try again later" });
  });

  it("drops a player whose socket closes and tells the rest via a debounced lobbyUpdate", async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice", gameId: "connect4" });
    await b.wait((f) => f.t === "lobbyUpdate" && f.d.queue.length === 1);
    const n = b.frames.length;
    a.close();
    await b.wait((f) => f.t === "lobbyUpdate" && f.d.queue.length === 0, n);
  });

  it("keeps the queue across eviction", async () => {
    await clear();
    const a = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    await evictDurableObject(lobby(), { webSockets: "hibernate" });
    expect((await a.call("getLobbyState")).queue).toMatchObject([{ displayName: "Alice" }]);
    expect(await a.call("leaveLobby")).toEqual({ success: true });
  });
});

const rooms = () => (env as unknown as { ROOM: DurableObjectNamespace<Room> }).ROOM;
const found = async (c: Awaited<ReturnType<typeof lobbyOf>>) => (await c.wait((f) => f.t === "matchFound")).d;

describe("matchFound and seat tokens", () => {
  it("matches two sockets; each token seats exactly the seat matchFound named", async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice", gameId: "connect4" });
    await b.call("joinLobby", { displayName: "Bob" });
    const ma = await found(a);
    const mb = await found(b);
    expect(ma).toMatchObject({ player: "X", opponent: "Bob" });
    expect(mb).toMatchObject({ player: "O", opponent: "Alice", roomId: ma.roomId });
    expect(ma.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(mb.token).not.toBe(ma.token);
    expect((await a.call("getLobbyState")).queue).toEqual([]);

    // Join in the opposite order of the seats: the token, not arrival order, decides.
    const rb = await open(`/ws/room/${ma.roomId}`);
    expect(await rb.call("joinRoom", { roomId: ma.roomId, clientId: "cb", token: mb.token })).toEqual({ player: "O" });
    const ra = await open(`/ws/room/${ma.roomId}`);
    expect(await ra.call("joinRoom", { roomId: ma.roomId, clientId: "ca", token: ma.token })).toEqual({ player: "X" });
    const u = await ra.update();
    expect(u).toMatchObject({ gameId: "connect4", roster: { XName: "Alice", OName: "Bob" } });
    await rb.wait((f) => f.t === "startGame");
  });

  it("refuses a reused, unknown or clientId-less token, and a claimed seat rebinds by clientId", async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    await b.call("joinLobby", { displayName: "Bob" });
    const ma = await found(a);
    const room = ma.roomId;
    const r1 = await open(`/ws/room/${room}`);
    expect(await r1.call("joinRoom", { roomId: room, clientId: "ca" })).toEqual({ player: "spectator" }); // a reserved seat is not open to a tokenless join
    expect(await r1.call("joinRoom", { roomId: room, token: ma.token })).toMatchObject({ error: "clientId required with seat token" });
    expect(await r1.call("joinRoom", { roomId: room, clientId: "ca", token: ma.token })).toEqual({ player: "X" });
    const r2 = await open(`/ws/room/${room}`);
    expect(await r2.call("joinRoom", { roomId: room, clientId: "evil", token: ma.token })).toMatchObject({ error: "Invalid or used seat token" });
    expect(await r2.call("joinRoom", { roomId: room, clientId: "x", token: "nope" })).toMatchObject({ error: "Invalid or used seat token" });
    // The seat is claimed: reconnect rebinds by clientId alone.
    r1.close();
    await new Promise((r) => setTimeout(r, 50));
    const r3 = await open(`/ws/room/${room}`);
    expect(await r3.call("joinRoom", { roomId: room, clientId: "ca" })).toEqual({ player: "X" });
  });

  it("matches FIFO and leaves the third player queued", async () => {
    await clear();
    const [a, b, c] = [await lobbyOf(), await lobbyOf(), await lobbyOf()];
    await a.call("joinLobby", { displayName: "Alice" });
    await b.call("joinLobby", { displayName: "Bob" });
    await c.call("joinLobby", { displayName: "Cara" });
    expect((await found(a)).player).toBe("X");
    expect((await c.call("getLobbyState")).queue).toMatchObject([{ displayName: "Cara" }]);
  });

  it("keeps unclaimed tokens across Room eviction", async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    await b.call("joinLobby", { displayName: "Bob" });
    const mb = await found(b);
    await evictDurableObject(rooms().getByName(mb.roomId));
    const r = await open(`/ws/room/${mb.roomId}`);
    expect(await r.call("joinRoom", { roomId: mb.roomId, clientId: "cb", token: mb.token })).toEqual({ player: "O" });
    await evictDurableObject(rooms().getByName(mb.roomId), { webSockets: "hibernate" });
    const r2 = await open(`/ws/room/${mb.roomId}`);
    expect(await r2.call("joinRoom", { roomId: mb.roomId, clientId: "x", token: mb.token })).toMatchObject({ error: "Invalid or used seat token" });
  });

  const matched = async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    await a.call("joinLobby", { displayName: "Alice" });
    await b.call("joinLobby", { displayName: "Bob" });
    const [ma, mb] = [await found(a), await found(b)];
    return { room: ma.roomId as string, ma, mb, a, b };
  };
  const stored = (room: string) => runInDurableObject(rooms().getByName(room), async (_o, st) => st.storage.get<any>("room"));

  it("never seats one socket or one clientId in both seats", async () => {
    const { room, ma, mb } = await matched();
    const s1 = await open(`/ws/room/${room}`);
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c1", token: ma.token })).toEqual({ player: "X" });
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c2", token: mb.token })).toEqual({ error: "Already seated" });
    const s2 = await open(`/ws/room/${room}`);
    expect(await s2.call("joinRoom", { roomId: room, clientId: "c1", token: mb.token })).toEqual({ error: "Already seated" });
    // The refused token was not consumed: its owner still gets O.
    const s3 = await open(`/ws/room/${room}`);
    expect(await s3.call("joinRoom", { roomId: room, clientId: "c3", token: mb.token })).toEqual({ player: "O" });
  });

  it("a retry with the used token and the owning clientId rebinds", async () => {
    const { room, ma } = await matched();
    const s1 = await open(`/ws/room/${room}`);
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c1", token: ma.token })).toEqual({ player: "X" });
    s1.close();
    await new Promise((r) => setTimeout(r, 50));
    const s2 = await open(`/ws/room/${room}`);
    expect(await s2.call("joinRoom", { roomId: room, clientId: "c1", token: ma.token })).toEqual({ player: "X" });
  });

  it("deletes an expired token, refuses it and opens the seat to a tokenless join", async () => {
    const { room, ma, mb } = await matched();
    await runInDurableObject(rooms().getByName(room), async (_o, st) => {
      const s = await st.storage.get<any>("room");
      s.seatTokens[mb.token].exp = Date.now() - 1;
      await st.storage.put("room", s);
    });
    await evictDurableObject(rooms().getByName(room));
    const s1 = await open(`/ws/room/${room}`);
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c2", token: mb.token })).toMatchObject({ error: "Invalid or used seat token" });
    expect(Object.keys((await stored(room)).seatTokens)).toEqual([ma.token]);
    const s2 = await open(`/ws/room/${room}`);
    expect(await s2.call("joinRoom", { roomId: room, clientId: "c3" })).toEqual({ player: "O" });
  });

  it("sends matchError to both players, without requeueing, when the Room cannot be made", async () => {
    await clear();
    const a = await lobbyOf();
    const b = await lobbyOf();
    const real: unknown = await runInDurableObject<Lobby, unknown>(lobby(), async (o: any) => {
      const env = o.env;
      o.env = { ...env, ROOM: { getByName: () => ({ reserveSeats: async () => { throw new Error("room down"); } }) } };
      return env;
    });
    try {
      await a.call("joinLobby", { displayName: "Alice" });
      await b.call("joinLobby", { displayName: "Bob" });
      for (const c of [a, b]) expect((await c.wait((f) => f.t === "matchError")).d).toEqual({ error: "Failed to create room" });
    } finally {
      await runInDurableObject<Lobby, void>(lobby(), async (o: any) => { o.env = real; });
    }
    expect((await a.call("getLobbyState")).queue).toEqual([]);
  });

  // Edit stored state, then evict so the Room reloads it (it caches state in memory).
  const edit = async (room: string, fn: (s: any) => void) => {
    await runInDurableObject(rooms().getByName(room), async (_o, st) => { const s = await st.storage.get<any>("room"); fn(s); await st.storage.put("room", s); });
    await evictDurableObject(rooms().getByName(room), { webSockets: "hibernate" });
  };

  it("consumes the token when its seat is already mapped to the joining clientId", async () => {
    const { room, ma } = await matched();
    await edit(room, (s) => { s.seatByClient.c9 = "X"; });
    const s1 = await open(`/ws/room/${room}`);
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c9", token: ma.token })).toEqual({ player: "X" });
    const s2 = await open(`/ws/room/${room}`);
    expect(await s2.call("joinRoom", { roomId: room, clientId: "c1", token: ma.token })).toEqual({ error: "Invalid or used seat token" });
  });

  it("does not overwrite a seat held by another socket and keeps the token", async () => {
    const { room, ma } = await matched();
    const s1 = await open(`/ws/room/${room}`);
    expect(await s1.call("joinRoom", { roomId: room, clientId: "c1", token: ma.token })).toEqual({ player: "X" });
    const before = (await stored(room)).players.X;
    await edit(room, (s) => { s.seatTokens[ma.token] = { seat: "X", exp: Date.now() + 60_000 }; });
    const s2 = await open(`/ws/room/${room}`);
    expect(await s2.call("joinRoom", { roomId: room, clientId: "c2", token: ma.token })).toEqual({ error: "Seat taken" });
    const after = await stored(room);
    expect(after.players.X).toBe(before);
    expect(after.seatTokens[ma.token]).toBeTruthy();
  });
});

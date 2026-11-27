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
});

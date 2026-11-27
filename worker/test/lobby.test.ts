import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { open } from "./helpers";
import type { Lobby } from "../src/lobby";

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

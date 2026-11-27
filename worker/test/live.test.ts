import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { open, type Client } from "./helpers";
import type { Lobby } from "../src/lobby";

const live = async () => {
  const r = await app.fetch(new Request("http://x/api/live"), env);
  expect(r.status).toBe(200);
  return (await r.json()) as { games: any[] };
};
// Rooms report to the registry after the move's broadcast, so poll until the list matches.
async function until(pred: (games: any[]) => boolean) {
  for (let i = 0; i < 100; i++) {
    const { games } = await live();
    if (pred(games)) return games;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`live never matched: ${JSON.stringify((await live()).games)}`);
}
const clear = () => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => { st.storage.sql.exec("DELETE FROM live"); });

async function pair(listPublicly?: boolean) {
  const a = await open("/ws/room/new");
  const { roomId } = await a.call("createRoom", { clientId: `a${Math.random()}`, displayName: "Alice", listPublicly });
  const b = await open(`/ws/room/${roomId}`);
  await b.call("joinRoom", { roomId, clientId: `b${Math.random()}`, displayName: "Bob" });
  return { a, b, roomId };
}
const mv = (c: Client, roomId: string, index: number) => c.send("makeMove", { roomId, index });

describe("GET /api/live", () => {
  it("lists a listed room once a move is played, with names and count but no ids", async () => {
    await clear();
    const { a, b, roomId } = await pair(true);
    expect((await live()).games).toEqual([]); // seated but nobody has moved
    mv(a, roomId, 4);
    const games = await until((g) => g.length === 1 && g[0].moves === 1);
    expect(games[0]).toEqual({ roomId, gameId: "ttt", players: ["Alice", "Bob"], moves: 1, startedAt: expect.any(Number) });
    mv(b, roomId, 0);
    await until((g) => g[0]?.moves === 2);
    const text = JSON.stringify(await live());
    expect(text).not.toContain(a.frames[0].d.sid);
    expect(text).not.toMatch(/clientId|sid/);
  });

  it("never lists a room created without listPublicly", async () => {
    await clear();
    const { a, roomId } = await pair();
    mv(a, roomId, 4);
    await a.update(); // the move was applied and published
    await new Promise((r) => setTimeout(r, 50));
    expect((await live()).games).toEqual([]);
  });

  it("drops the room when the game ends, or a player leaves", async () => {
    await clear();
    const x = await pair(true);
    mv(x.a, x.roomId, 4);
    await until((g) => g.length === 1);
    x.a.send("resign", { roomId: x.roomId });
    await until((g) => g.length === 0);

    const y = await pair(true);
    mv(y.a, y.roomId, 4);
    await until((g) => g.length === 1);
    y.b.close();
    await until((g) => g.length === 0);
  });

  it("lists a lobby-matched room after its first move", async () => {
    await clear();
    const la = await open("/ws/lobby");
    const lb = await open("/ws/lobby");
    await la.call("joinLobby", { displayName: "Ada", gameId: "connect4" });
    await lb.call("joinLobby", { displayName: "Bo", gameId: "connect4" });
    const ma = (await la.wait((f) => f.t === "matchFound")).d;
    const mb = (await lb.wait((f) => f.t === "matchFound")).d;
    const ra = await open(`/ws/room/${ma.roomId}`);
    await ra.call("joinRoom", { roomId: ma.roomId, clientId: "ca", token: ma.token });
    const rb = await open(`/ws/room/${ma.roomId}`);
    await rb.call("joinRoom", { roomId: ma.roomId, clientId: "cb", token: mb.token });
    ra.send("makeMove", { roomId: ma.roomId, move: { type: "place", cell: 3 } });
    const games = await until((g) => g.length === 1);
    expect(games[0]).toMatchObject({ roomId: ma.roomId, gameId: "connect4", players: ["Ada", "Bo"], moves: 1 });
  });

  it("rejects writes: only GET is routed", async () => {
    const r = await app.fetch(new Request("http://x/api/live", { method: "POST" }), env);
    expect(r.status).toBe(404);
  });
});

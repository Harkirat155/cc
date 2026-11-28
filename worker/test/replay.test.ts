import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { open } from "./helpers";
import type { Lobby } from "../src/lobby";

let ipN = 0;
const lobbyStub = () => (env as any).LOBBY.getByName("lobby");
const sql = <T>(fn: (s: any) => T) => runInDurableObject(lobbyStub(), async (_o: Lobby, st) => fn(st.storage.sql));
const get = (path: string) => app.fetch(new Request(`http://x${path}`), env);
const register = async (name: string, unlisted = false) => {
  const r = await app.fetch(new Request("http://x/api/bots", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": `10.2.0.${++ipN}` }, body: JSON.stringify({ name, unlisted }) }), env);
  return ((await r.json()) as { key: string }).key;
};
const play = (id: string, a: string | null, b: string | null, score: 0 | 0.5 | 1, replay?: { first: 0 | 1; moves: unknown[] }) =>
  runInDurableObject(lobbyStub(), async (o: Lobby) => (o as any).recordGame(id, "ttt", a, b, score, replay));
const MOVES = [{ type: "place", cell: 4 }, { type: "place", cell: 0 }, { type: "place", cell: 8 }];

beforeEach(async () => {
  await sql((s) => { for (const t of ["bots", "ratings", "settled_games", "house_games", "bot_games", "bot_reg", "unlisted_bots", "replays", "replay_links"]) try { s.exec(`DELETE FROM ${t}`); } catch { /* table not there yet */ } });
});

describe("GET /api/replay/:id", () => {
  it("returns the moves, players, game type and result stored at settlement", async () => {
    await register("Replay Bot");
    await play("r1", "Replay Bot", "House (easy)", 1, { first: 0, moves: MOVES });
    const r = await get("/api/replay/r1");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: "r1", gameId: "ttt", players: ["Replay Bot", "House (easy)"], first: 0, result: "X", moves: MOVES, at: expect.any(Number) });
  });

  it("names a guest side 'guest' and records a draw", async () => {
    await register("Draw Bot");
    await play("r2", null, "Draw Bot", 0.5, { first: 1, moves: MOVES });
    expect(await (await get("/api/replay/r2")).json()).toMatchObject({ players: ["guest", "Draw Bot"], first: 1, result: "draw" });
  });

  it("is 404 for an unknown id, and a game settled without moves has none", async () => {
    const u = await get("/api/replay/nope");
    expect(u.status).toBe(404);
    expect(await u.json()).toEqual({ error: "replay not found" });
    await register("Old Bot");
    await play("old1", "Old Bot", null, 1);
    expect((await get("/api/replay/old1")).status).toBe(404);
  });

  it("is stored once: a second settlement of the same id keeps the first moves", async () => {
    await register("Once Bot");
    await play("r3", "Once Bot", null, 1, { first: 0, moves: MOVES });
    await play("r3", "Once Bot", null, 1, { first: 0, moves: [{ type: "place", cell: 1 }] });
    expect(((await (await get("/api/replay/r3")).json()) as any).moves).toEqual(MOVES);
  });

  it("is written by a real Room at settlement", async () => {
    const key = await register("Room Bot");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "rb-a", displayName: "Room Bot", botKey: key, gameId: "ttt" });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: "rb-b", displayName: "Human" });
    a.send("makeMove", { roomId, index: 4 });
    await a.update(1);
    b.send("makeMove", { roomId, index: 0 });
    b.send("resign", { roomId });
    let id = "";
    for (let i = 0; i < 100 && !id; i++) { id = (await (await get("/api/arena/Room%20Bot")).json() as any).games[0]?.replayId ?? ""; if (!id) await new Promise((r) => setTimeout(r, 10)); }
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const rp = await (await get(`/api/replay/${id}`)).json() as any;
    expect(rp).toMatchObject({ gameId: "ttt", players: ["Room Bot", "guest"], first: 0, result: "X" });
    expect(rp.moves.slice(0, 1)).toEqual([{ type: "place", cell: 4 }]);
  });
});

describe("game id on rows", () => {
  it("is on a bot's recent games and on the feed, and absent for a game with no replay", async () => {
    await register("Row Bot");
    await play("a1", "Row Bot", null, 1, { first: 0, moves: MOVES });
    await play("a2", "Row Bot", null, 0, undefined);
    const games = ((await (await get("/api/arena/Row%20Bot")).json()) as any).games;
    expect(games[0].replayId).toBeUndefined();
    expect(games[1].replayId).toBe("a1");
    const feed = ((await (await get("/api/arena-feed")).json()) as any).feed;
    expect(feed.map((r: any) => r.replayId)).toEqual([undefined, "a1"]);
  });

  it("does not put an unlisted opponent's game in the feed of the listed bot's row link", async () => {
    await register("Shown Bot"); await register("Hidden Bot", true);
    await play("u1", "Shown Bot", "Hidden Bot", 1, { first: 0, moves: MOVES });
    const feed = ((await (await get("/api/arena-feed")).json()) as any).feed;
    expect(feed).toHaveLength(1);
    expect(feed[0].replayId).toBeUndefined();
    expect(JSON.stringify(feed)).not.toMatch(/hidden/i);
    const own = ((await (await get("/api/arena/Hidden%20Bot")).json()) as any).games;
    expect(own[0].replayId).toBe("u1");
  });
});

describe("a game whose log is incomplete stores no replay", () => {
  // A bot plays X's first move, the stored room is edited, then O moves and X resigns: a rated game with 2 moves.
  async function settled(name: string, edit: (room: any) => void) {
    const key = await register(name);
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: `${name}-a`, displayName: name, botKey: key, gameId: "ttt" });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: `${name}-b`, displayName: "Human" });
    a.send("makeMove", { roomId, index: 4 });
    await a.update(1);
    const stub = (env as any).ROOM.getByName(roomId);
    await runInDurableObject(stub, async (_o, st) => { const room = await st.storage.get<any>("room"); edit(room); await st.storage.put("room", room); });
    await evictDurableObject(stub, { webSockets: "hibernate" });
    b.send("makeMove", { roomId, index: 0 });
    b.send("resign", { roomId });
    let games: any[] = [];
    for (let i = 0; i < 100 && !games.length; i++) { games = ((await (await get(`/api/arena/${encodeURIComponent(name)}`)).json()) as any).games; if (!games.length) await new Promise((r) => setTimeout(r, 10)); }
    expect(games).toHaveLength(1);
    return games[0];
  }

  it("a room saved before replays (moves > 0, no log) settles with no replay", async () => {
    const g = await settled("Legacy Bot", (room) => { delete room.log; delete room.first; });
    expect(g.replayId).toBeUndefined();
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM replays").one().n)).toBe(0);
  });

  it("a log past the 500-move cap is dropped and settles with no replay", async () => {
    const g = await settled("Capped Bot", (room) => { room.log = Array.from({ length: 500 }, () => ({ type: "place", cell: 0 })); room.moves = 500; });
    expect(g.replayId).toBeUndefined();
  });
});

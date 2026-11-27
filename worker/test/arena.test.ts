import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { open } from "./helpers";
import type { Lobby } from "../src/lobby";

let ipN = 0;
const register = (name: unknown, ip = `10.0.0.${++ipN}`) =>
  app.fetch(new Request("http://x/api/bots", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ name }) }), env);
const arena = async () => (await (await app.fetch(new Request("http://x/api/arena"), env)).json()) as { games: Record<string, any[]> };
const sql = <T>(fn: (s: any) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => fn(st.storage.sql));
const until = async (pred: (a: Record<string, any[]>) => boolean) => {
  for (let i = 0; i < 100; i++) { const a = (await arena()).games; if (pred(a)) return a; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error(`arena never matched: ${JSON.stringify(await arena())}`);
};
const bot = async (name: string) => ((await (await register(name)).json()) as { key: string }).key;

beforeEach(async () => { await sql((s) => { s.exec("DELETE FROM bots"); s.exec("DELETE FROM ratings"); s.exec("DELETE FROM bot_reg"); s.exec("DELETE FROM settled_games"); }); });

// A bot (or null = anonymous) creates a room, an opponent joins, X plays one move, then `loser` resigns.
async function game(x: { name: string; key?: string }, o: { name: string; key?: string }, loser: "X" | "O", gameId = "ttt") {
  const a = await open("/ws/room/new");
  const { roomId } = await a.call("createRoom", { clientId: `a${Math.random()}`, displayName: x.name, botKey: x.key, gameId });
  const b = await open(`/ws/room/${roomId}`);
  const j = await b.call("joinRoom", { roomId, clientId: `b${Math.random()}`, displayName: o.name, botKey: o.key });
  expect(j.player).toBe("O");
  a.send("makeMove", { roomId, index: 4 });
  await a.update(1);
  (loser === "X" ? a : b).send("resign", { roomId });
  return { a, b, roomId };
}

describe("POST /api/bots", () => {
  it("registers a name and returns a key once", async () => {
    const r = await register("Alpha Bot_1");
    expect(r.status).toBe(201);
    const body = (await r.json()) as { name: string; key: string };
    expect(body.name).toBe("Alpha Bot_1");
    expect(body.key).toMatch(/^ccb_[0-9a-f]{48}$/);
  });

  it("stores only a SHA-256 hash of the key", async () => {
    const key = await bot("Hashy");
    const dump = JSON.stringify(await sql((s) => s.exec("SELECT * FROM bots").toArray()));
    expect(dump).not.toContain(key);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].map((x) => x.toString(16).padStart(2, "0")).join("");
    expect(dump).toContain(hash);
  });

  it("rejects a duplicate name, case-insensitively, with 409", async () => {
    await bot("Taken");
    expect((await register("taken")).status).toBe(409);
  });

  it("rejects bad names with 400", async () => {
    for (const n of ["ab", "x".repeat(25), "bad<name>", "", 5, undefined]) expect((await register(n)).status).toBe(400);
  });

  it("rate-limits per IP with 429", async () => {
    for (let i = 0; i < 3; i++) expect((await register(`Rl${i}`, "9.9.9.9")).status).toBe(201);
    expect((await register("Rl3", "9.9.9.9")).status).toBe(429);
    expect((await register("Rl4", "8.8.8.8")).status).toBe(201);
  });
});

describe("rated games", () => {
  it("updates Elo when a registered bot beats a guest, and lists it without keys or sids", async () => {
    const key = await bot("Winner");
    const g = await game({ name: "Winner", key }, { name: "Human" }, "O");
    const games = await until((a) => a.ttt?.length === 1);
    expect(games.ttt[0]).toEqual({ name: "Winner", rating: 1216, games: 1, wins: 1, draws: 0, losses: 0 });
    const text = JSON.stringify(await arena());
    expect(text).not.toContain(key);
    expect(text).not.toContain(g.a.frames[0].d.sid);
    expect(text).not.toMatch(/key|sid|hash/i);
  });

  it("rates a loss against a guest", async () => {
    const key = await bot("Loser");
    await game({ name: "Loser", key }, { name: "Human" }, "X");
    const games = await until((a) => a.ttt?.length === 1);
    expect(games.ttt[0]).toMatchObject({ rating: 1184, games: 1, wins: 0, losses: 1 });
  });

  it("rates two registered bots against each other, per game type", async () => {
    const ka = await bot("BotA");
    const kb = await bot("BotB");
    await game({ name: "BotA", key: ka }, { name: "BotB", key: kb }, "O", "connect4");
    const games = await until((a) => a.connect4?.length === 2);
    expect(games.connect4.map((r) => [r.name, r.rating])).toEqual([["BotA", 1216], ["BotB", 1184]]);
    expect(games.ttt ?? []).toEqual([]);
  });

  it("settles a game once, not on every later broadcast", async () => {
    const key = await bot("Once");
    const g = await game({ name: "Once", key }, { name: "Human" }, "O");
    await until((a) => a.ttt?.length === 1);
    g.b.send("updateDisplayName", { roomId: g.roomId, displayName: "Still Human" });
    await g.a.wait((f) => f.t === "gameUpdate" && f.d.roster.OName === "Still Human");
    await new Promise((r) => setTimeout(r, 50));
    expect((await arena()).games.ttt[0].games).toBe(1);
  });

  it("leaves ratings unchanged when nobody presented a key", async () => {
    await bot("Idle");
    await game({ name: "Idle" }, { name: "Human" }, "O");
    await new Promise((r) => setTimeout(r, 100));
    expect((await arena()).games).toEqual({});
  });

  it("does not rate a game with no moves played", async () => {
    const key = await bot("Quick");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "qa", displayName: "Quick", botKey: key });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: "qb", displayName: "H" });
    b.send("resign", { roomId });
    await new Promise((r) => setTimeout(r, 100));
    expect((await arena()).games).toEqual({});
  });

  it("refuses a wrong key at join, so a typo cannot silently play unrated", async () => {
    const a = await open("/ws/room/new");
    const r = await a.call("createRoom", { clientId: "w", displayName: "W", botKey: "ccb_nope" });
    expect(r).toEqual({ error: "Invalid bot key" });
  });
});

const quiet = async () => { await new Promise((r) => setTimeout(r, 100)); return (await arena()).games; };
const room = (roomId: string): any => (env as any).ROOM.getByName(roomId);
const botBySid = (roomId: string): Promise<Record<string, string>> => (runInDurableObject as any)(room(roomId), async (o: any) => ({ ...o.s.botBySid }));

describe("rating identity is frozen at the first move", () => {
  it("ignores a key presented only after the game started", async () => {
    const key = await bot("Late");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "la", displayName: "G" });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: "lb", displayName: "G2" });
    a.send("makeMove", { roomId, index: 4 });
    await a.update(1);
    expect((await b.call("joinRoom", { roomId, clientId: "lb", botKey: key })).player).toBe("O");
    a.send("resign", { roomId });
    expect(await quiet()).toEqual({});
  });

  it("does not let a substitute in a vacated seat inherit the result", async () => {
    const ka = await bot("SubA");
    const kb = await bot("SubB");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "sa", displayName: "A", botKey: ka });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: "sb", displayName: "G" });
    a.send("makeMove", { roomId, index: 4 });
    await a.update(1);
    b.close();
    const c = await open(`/ws/room/${roomId}`);
    expect((await c.call("joinRoom", { roomId, clientId: "sc", botKey: kb })).player).toBe("O");
    c.send("resign", { roomId });
    expect(await quiet()).toEqual({});
  });

  it("takes a fresh snapshot for the game after a reset", async () => {
    const key = await bot("Rematch");
    const g = await game({ name: "Rematch", key }, { name: "Human" }, "O");
    await until((a) => a.ttt?.[0]?.games === 1);
    g.a.send("resetGame", { roomId: g.roomId });
    await g.a.wait((f) => f.t === "gameReset");
    await g.a.call("joinRoom", { roomId: g.roomId, clientId: "x" }); // keyless rejoin: no longer a bot
    g.a.send("makeMove", { roomId: g.roomId, index: 4 }); // whoever has the turn moves; the other is dropped
    g.b.send("makeMove", { roomId: g.roomId, index: 0 });
    await new Promise((r) => setTimeout(r, 50));
    g.b.send("resign", { roomId: g.roomId });
    expect((await quiet()).ttt[0].games).toBe(1);
  });
});

describe("botBySid hygiene", () => {
  it("records a seated bot only, drops it on a keyless join and when the seat is freed", async () => {
    const key = await bot("Seat");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "ha", displayName: "G" });
    const b = await open(`/ws/room/${roomId}`);
    await b.call("joinRoom", { roomId, clientId: "hb", botKey: key });
    const c = await open(`/ws/room/${roomId}`);
    expect((await c.call("joinRoom", { roomId, clientId: "hc", botKey: key })).player).toBe("spectator");
    expect(Object.values(await botBySid(roomId))).toEqual(["Seat"]);
    await b.call("joinRoom", { roomId, clientId: "hb" });
    expect(await botBySid(roomId)).toEqual({});
    await b.call("joinRoom", { roomId, clientId: "hb", botKey: key });
    expect(Object.values(await botBySid(roomId))).toEqual(["Seat"]);
    b.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(await botBySid(roomId)).toEqual({});
  });

  it("says the arena is unavailable, not that the key is invalid, when the lookup fails", async () => {
    const key = await bot("Down");
    const a = await open("/ws/room/new");
    const { roomId } = await a.call("createRoom", { clientId: "da", displayName: "G" });
    await (runInDurableObject as any)(room(roomId), async (o: any) => { o.lobby = () => ({ verifyBot: async () => { throw new Error("rpc"); } }); });
    const b = await open(`/ws/room/${roomId}`);
    expect(await b.call("joinRoom", { roomId, clientId: "db", botKey: key })).toEqual({ error: "Arena unavailable, try again" });
    expect(await b.call("joinRoom", { roomId, clientId: "db", botKey: 5 })).toEqual({ error: "Invalid bot key" });
  });
});

describe("lobby integrity", () => {
  it("lets exactly one of many concurrent registrations of a name win, the rest get 409", async () => {
    const s = (await Promise.all(Array.from({ length: 6 }, () => register("Racer")))).map((r) => r.status).sort();
    expect(s).toEqual([201, 409, 409, 409, 409, 409]);
  });

  it("caps concurrent registrations from one IP at the hourly limit", async () => {
    const s = (await Promise.all(Array.from({ length: 6 }, (_, i) => register(`Ip${i}`, "7.7.7.7")))).map((r) => r.status).sort();
    expect(s).toEqual([201, 201, 201, 429, 429, 429]);
  });

  it("rates a settlement id once, however often it is recorded", async () => {
    await bot("Idem");
    await (runInDurableObject as any)((env as any).LOBBY.getByName("lobby"), async (o: Lobby) => { o.recordGame("g1", "ttt", "Idem", null, 1); o.recordGame("g1", "ttt", "Idem", null, 1); });
    expect((await arena()).games.ttt[0]).toMatchObject({ rating: 1216, games: 1 });
  });
});

describe("GET /api/arena", () => {
  it("is empty before any bot has played, and only GET is routed", async () => {
    expect(await arena()).toEqual({ games: {} });
    expect((await app.fetch(new Request("http://x/api/arena", { method: "POST" }), env)).status).toBe(404);
  });
});

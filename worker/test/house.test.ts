import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { open } from "./helpers";

let ipN = 100;
const register = (name: unknown) =>
  app.fetch(new Request("http://x/api/bots", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": `10.1.0.${++ipN}` }, body: JSON.stringify({ name }) }), env);
const arena = async () => (await (await app.fetch(new Request("http://x/api/arena"), env)).json()) as { games: Record<string, any[]> };
const sql = (fn: (s: any) => unknown) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o, st) => fn(st.storage.sql));
const bot = async (name: string) => ((await (await register(name)).json()) as { key: string }).key;
const filled = (board: unknown[]) => board.filter((c) => c !== null && c !== "" && c !== 0).length;

beforeEach(async () => { await sql((s) => { for (const t of ["bots", "ratings", "bot_reg", "settled_games", "live", "house_games"]) s.exec(`DELETE FROM ${t}`); }); });

async function vsHouse(level: string, gameId = "ttt", extra: object = {}) {
  const key = await bot(`Tester${++ipN}`);
  const a = await open("/ws/room/new");
  const r = await a.call("createRoom", { clientId: `c${ipN}`, displayName: "T", botKey: key, gameId, vsHouse: level, ...extra });
  return { a, r, key, roomId: r.roomId as string };
}

// Plays the bot's first legal move until the game ends; returns the last gameUpdate.
async function playOut(a: Awaited<ReturnType<typeof open>>, roomId: string, gameId: string, maxMoves = 60) {
  let seen = a.frames.length;
  for (let i = 0; i < maxMoves; i++) {
    const u = a.frames.slice(seen).reverse().find((f) => f.t === "gameUpdate")?.d ?? (await a.update(seen));
    if (u.status !== "active") return u;
    const move = gameId === "ttt" ? { index: u.board.findIndex((c: unknown) => !c) } : { move: { type: "place", cell: u.moveCell } };
    seen = a.frames.length;
    a.send("makeMove", { roomId, ...move });
    await a.update(seen);
  }
  throw new Error("game did not finish");
}

describe("vsHouse", () => {
  it("answers each move with a legal reply and gives the move back to the bot", async () => {
    const { a, r, roomId } = await vsHouse("easy");
    expect(r).toEqual({ roomId, player: "X", house: "House (easy)" });
    const from = a.frames.length;
    a.send("makeMove", { roomId, index: 4 });
    const u = (await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from)).d;
    expect(filled(u.board)).toBe(2);
    expect(u.turnSlot).toBe(0);
    expect(u.lastMoveBy).toBe(1);
    expect(u.roster.OName).toBe("House (easy)");
  });

  it("finishes a game and rates both the bot and the House entry", async () => {
    const { a, roomId } = await vsHouse("easy");
    const end = await playOut(a, roomId, "ttt");
    expect(["win", "draw"]).toContain(end.status);
    let rows: any[] = [];
    for (let i = 0; i < 100 && rows.length < 2; i++) { rows = (await arena()).games.ttt ?? []; await new Promise((r) => setTimeout(r, 10)); }
    expect(rows.map((r) => r.name).sort()).toEqual(["House (easy)", expect.stringMatching(/^Tester/)].sort());
    expect(rows.reduce((n, r) => n + r.games, 0)).toBe(2);
    expect(rows.reduce((n, r) => n + r.rating, 0)).toBe(2400); // Elo is zero-sum
  });

  it("is never listed on /api/live, even with listPublicly", async () => {
    const { a, roomId } = await vsHouse("easy", "ttt", { listPublicly: true });
    const from = a.frames.length;
    a.send("makeMove", { roomId, index: 4 });
    await a.update(from);
    await new Promise((r) => setTimeout(r, 50));
    const live = (await (await app.fetch(new Request("http://x/api/live"), env)).json()) as any;
    expect(JSON.stringify(live)).not.toContain(roomId);
  });

  it("opens the next game itself when a rematch gives it the first move", async () => {
    const { a, roomId } = await vsHouse("easy");
    let from = a.frames.length;
    a.send("makeMove", { roomId, index: 4 });
    await a.update(from);
    a.send("resign", { roomId });
    await a.wait((f) => f.t === "gameUpdate" && f.d.status === "win");
    from = a.frames.length;
    a.send("resetGame", { roomId });
    const u = (await a.wait((f) => f.t === "gameUpdate" && filled(f.d.board) === 1, from)).d;
    expect(u.turnSlot).toBe(0);
    expect(u.lastMoveBy).toBe(1);
  });

  it("does not rate a house game where a guest took the bot's seat", async () => {
    const { a, roomId } = await vsHouse("easy");
    a.close();
    await new Promise((r) => setTimeout(r, 30));
    const g = await open(`/ws/room/${roomId}`);
    expect((await g.call("joinRoom", { roomId, clientId: "guest" })).player).toBe("X");
    g.send("makeMove", { roomId, index: 4 });
    await g.update(0);
    g.send("resign", { roomId });
    await new Promise((r) => setTimeout(r, 100));
    expect((await arena()).games).toEqual({});
  });

  it("refuses a bad level, a missing botKey and a game switch", async () => {
    const a = await open("/ws/room/new");
    const key = await bot("Refuser");
    expect(await a.call("createRoom", { botKey: key, vsHouse: "insane" })).toEqual({ error: "vsHouse must be easy, medium or hard" });
    const b = await open("/ws/room/new");
    expect(await b.call("createRoom", { vsHouse: "easy" })).toEqual({ error: "vsHouse needs a botKey" });
    const { a: c, roomId } = await vsHouse("easy");
    expect((await c.call("switchGame", { roomId, gameId: "connect4" })).success).toBe(false);
  });
});

describe("compute cap", () => {
  it.each([["connect4", "hard", "medium"], ["checkers", "hard", "medium"], ["five", "hard", "easy"], ["five", "medium", "easy"]])("refuses %s at %s, above its cap of %s on workerd", async (g, level, cap) => {
    const a = await open("/ws/room/new");
    const key = await bot(`Cap${g}${level}`);
    expect(await a.call("createRoom", { botKey: key, gameId: g, vsHouse: level })).toEqual({ error: `the house plays up to ${cap} at ${g}` });
  });

  it("allows five at easy and answers", async () => {
    const { a, r, roomId } = await vsHouse("easy", "five");
    expect(r.house).toBe("House (easy)");
    const from = a.frames.length;
    a.send("makeMove", { roomId, move: { type: "place", cell: 112 } });
    expect((await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from)).d.lastMoveBy).toBe(1);
  });

  it("allows hard at ttt", async () => {
    expect((await vsHouse("hard")).r.house).toBe("House (hard)");
  });

  it.each(["connect4", "checkers"])("answers a medium %s move within the cap", async (g) => {
    const { a, r, roomId } = await vsHouse("medium", g);
    expect(r.house).toBe("House (medium)");
    const from = a.frames.length;
    const t = Date.now();
    a.send("makeMove", { roomId, move: g === "connect4" ? { type: "place", cell: 3 } : (await firstMove(roomId)) });
    const u = (await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from)).d;
    expect(u.lastMoveBy).toBe(1);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});

// Checkers needs a legal opening transfer: ask the rules, not a guess.
async function firstMove(roomId: string) {
  return (runInDurableObject as any)((env as any).ROOM.getByName(roomId), async (o: any) => {
    const { get } = await import("../../shared/games/registry.js");
    return get(o.s.gameId).getLegalMoves(o.s.state, 0)[0];
  });
}

describe("reserved names", () => {
  it.each(["House (easy)", "House easy", "house-easy", "HOUSE_MEDIUM", "House  Hard", "H0use easy", "house medIum", "h0use_hard", "House_Med1um"])("refuses %j", async (n) => {
    expect([400, 409]).toContain((await register(n)).status);
  });
  it("refuses with 409 'name reserved' where the name is otherwise valid", async () => {
    const r = await register("House_Hard");
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "name reserved" });
  });
  it("still allows a name that merely starts with House", async () => {
    expect((await register("Housemate")).status).toBe(201);
  });
});

describe("no dodging a loss", () => {
  const rows = async (n: number) => { let r: any[] = []; for (let i = 0; i < 100; i++) { r = (await arena()).games.ttt ?? []; if (r.length >= n) break; await new Promise((x) => setTimeout(x, 10)); } return r; };
  const bots = (r: any[]) => r.find((x) => x.name !== "House (easy)");

  it("refuses resetGame mid-game; resigning is then rated as a loss", async () => {
    const { a, roomId } = await vsHouse("easy");
    let from = a.frames.length;
    a.send("makeMove", { roomId, index: 4 });
    await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from);
    from = a.frames.length;
    a.send("resetGame", { roomId });
    const e = await a.wait((f) => f.t === "error", from);
    expect(e.d.message).toBe("resign to start over");
    expect(a.frames.slice(from).some((f) => f.t === "gameReset")).toBe(false);
    a.send("resign", { roomId });
    expect(bots(await rows(2))).toMatchObject({ games: 1, losses: 1, rating: 1184 });
  });

  it("settles a bot that leaves mid-game as a loss", async () => {
    const { a, roomId } = await vsHouse("easy");
    const from = a.frames.length;
    a.send("makeMove", { roomId, index: 4 });
    await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from);
    a.close();
    expect(bots(await rows(2))).toMatchObject({ games: 1, losses: 1 });
    const g = await open(`/ws/room/${roomId}`); // a guest cannot revive or re-rate it
    await g.call("joinRoom", { roomId, clientId: "guest" });
    await new Promise((r) => setTimeout(r, 50));
    expect(bots(await rows(2))).toMatchObject({ games: 1 });
  });

  it("rates a rematch as a new game", async () => {
    const { a, roomId } = await vsHouse("easy");
    for (let n = 1; n <= 2; n++) {
      const from = a.frames.length;
      a.send("makeMove", { roomId, index: [4, 4][n - 1] });
      await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy !== null, from);
      a.send("resign", { roomId });
      await a.wait((f) => f.t === "gameUpdate" && f.d.status === "win", from);
      if (n === 1) { a.send("resetGame", { roomId }); await a.wait((f) => f.t === "gameReset", from); }
    }
    expect(bots(await rows(2))).toMatchObject({ games: 2, losses: 2 });
  });

  it("plays but does not rate past 20 house games a day, and says so", async () => {
    const key = await bot("Farmer");
    for (let i = 0; i < 21; i++) {
      const a = await open("/ws/room/new");
      const { roomId } = await a.call("createRoom", { clientId: `f${i}`, displayName: "F", botKey: key, vsHouse: "easy" });
      const from = a.frames.length;
      a.send("makeMove", { roomId, index: 4 });
      await a.wait((f) => f.t === "gameUpdate" && f.d.lastMoveBy === 1, from);
      a.send("resign", { roomId });
      if (i === 20) expect((await a.wait((f) => f.t === "unrated")).d.reason).toBe("daily house limit");
      else await a.wait((f) => f.t === "gameUpdate" && f.d.status === "win", from);
      await new Promise((r) => setTimeout(r, 5));
      a.close();
    }
    expect((await arena()).games.ttt.find((r) => r.name === "Farmer")).toMatchObject({ games: 20 });
  });
});

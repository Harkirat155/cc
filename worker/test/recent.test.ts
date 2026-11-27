import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

const lobby = <T>(fn: (o: Lobby) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (o: Lobby) => fn(o));
const sql = <T>(fn: (s: any) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => fn(st.storage.sql));
const recent = (name: string) => app.fetch(new Request(`http://x/api/arena/${encodeURIComponent(name)}`), env);
const reg = (name: string) => sql((s) => s.exec("INSERT OR REPLACE INTO bots (name, name_lc, key_hash, created_at) VALUES (?, ?, ?, 0)", name, name.toLowerCase(), `h${name}`));
const play = (id: string, game: string, a: string | null, b: string | null, score: 0 | 0.5 | 1) => lobby((o) => o.recordGame(id, game, a, b, score));

beforeEach(async () => { await sql((s) => { for (const t of ["bots", "ratings", "settled_games", "house_games", "bot_games"]) s.exec(`DELETE FROM ${t}`); }); });

describe("GET /api/arena/:name", () => {
  it("lists a rated game for both bots with opposite results, ratings after, names only", async () => {
    await reg("Alpha Bot"); await reg("Beta Bot");
    await play("g1", "ttt", "Alpha Bot", "Beta Bot", 1);
    const a = await (await recent("alpha bot")).json() as any;
    const b = await (await recent("Beta Bot")).json() as any;
    expect(a).toEqual({ name: "Alpha Bot", games: [{ gameId: "ttt", opponent: "Beta Bot", result: "win", ratingAfter: 1216, at: expect.any(Number) }] });
    expect(b.games[0]).toMatchObject({ gameId: "ttt", opponent: "Alpha Bot", result: "loss", ratingAfter: 1184 });
    await play("g2", "ttt", "Alpha Bot", null, 0.5);
    expect((await (await recent("Alpha Bot")).json() as any).games[0]).toMatchObject({ opponent: "guest", result: "draw" });
  });

  it("lists newest first and caps at 10", async () => {
    await reg("Capper");
    for (let i = 0; i < 12; i++) await play(`g${i}`, i === 11 ? "connect4" : "ttt", "Capper", null, 1);
    const r = await recent("Capper");
    expect(r.status).toBe(200);
    const { games } = await r.json() as any;
    expect(games).toHaveLength(10);
    expect(games[0].gameId).toBe("connect4");
    const ratings = games.map((g: any) => g.ratingAfter);
    expect(ratings[1]).toBeGreaterThan(ratings[2]); // ttt streak: later games have higher rating
  });

  it("returns 404 for an unknown bot and a name that fails the name rule, and [] for a known bot with no games", async () => {
    const u = await recent("Nobody");
    expect(u.status).toBe(404);
    expect(await u.json()).toEqual({ error: "bot not found" });
    expect((await recent("ab")).status).toBe(404);
    expect((await recent("House (easy)")).status).toBe(404);
    await reg("Fresh Bot");
    const r = await recent("Fresh Bot");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ name: "Fresh Bot", games: [] });
  });

  it("never shows keys, hashes, room or settlement ids, and the badge route still wins", async () => {
    await reg("Leaky"); await play("settle-id-77", "ttt", "Leaky", "House (easy)", 1);
    const body = await (await recent("Leaky")).text();
    expect(body).toContain("House (easy)");
    expect(body).not.toMatch(/hLeaky|settle-id|roomId|key|hash/i);
    const badge = await app.fetch(new Request("http://x/api/arena/badge/Leaky.svg?game=ttt"), env);
    expect(badge.headers.get("content-type")).toContain("image/svg+xml");
  });
});

describe("settlement", () => {
  const count = (t: string, where = "1=1") => sql((s) => s.exec(`SELECT COUNT(*) AS n FROM ${t} WHERE ${where}`).one().n as number);

  it("is all-or-nothing: a throw leaves no settled mark, rating or history row", async () => {
    await reg("Atomic"); await reg("Boom");
    await sql((s) => s.exec("CREATE TRIGGER bg_boom BEFORE INSERT ON bot_games WHEN NEW.name_lc = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END"));
    try {
      await expect(play("tx1", "ttt", "Atomic", "Boom", 1)).rejects.toThrow();
    } finally { await sql((s) => s.exec("DROP TRIGGER bg_boom")); }
    expect(await count("settled_games")).toBe(0);
    expect(await count("ratings")).toBe(0);
    expect(await count("bot_games")).toBe(0);
  });

  it("replaying a settlement id leaves one history row per bot and the ratings unchanged", async () => {
    await reg("Replay A"); await reg("Replay B");
    await play("rp1", "ttt", "Replay A", "Replay B", 1);
    const before = await sql((s) => s.exec("SELECT name_lc, rating FROM ratings ORDER BY name_lc").toArray());
    expect(await play("rp1", "ttt", "Replay A", "Replay B", 1)).toBe("skipped");
    expect(await count("bot_games")).toBe(2);
    expect(await sql((s) => s.exec("SELECT name_lc, rating FROM ratings ORDER BY name_lc").toArray())).toEqual(before);
  });

  it("writes exactly one history row for a bot-vs-House game, and none when the daily house limit makes it unrated", async () => {
    await reg("Houseman");
    await play("h1", "ttt", "Houseman", "House (easy)", 1);
    expect(await count("bot_games")).toBe(1);
    expect(await count("bot_games", "name_lc LIKE 'house (%'")).toBe(0);
    expect(await count("ratings", "name_lc = 'house (easy)'")).toBe(1); // house ratings unchanged
    await sql((s) => s.exec("UPDATE house_games SET n = 20"));
    expect(await play("h2", "ttt", "Houseman", "House (easy)", 1)).toBe("limit");
    expect(await count("bot_games")).toBe(1);
  });
});

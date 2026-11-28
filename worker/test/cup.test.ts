import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";
import { cupDrawTime, pairRounds } from "../src/cup";

const lobby = () => (env as any).LOBBY.getByName("lobby");
const sql = <T>(fn: (s: any) => T) => runInDurableObject(lobby(), async (_o: Lobby, st) => fn(st.storage.sql));
const play = (id: string, game: string, a: string, b: string, score: 0 | 0.5 | 1) => runInDurableObject(lobby(), async (o: Lobby) => o.recordGame(id, game, a, b, score));
const cup = () => app.fetch(new Request("http://x/api/arena/cup"), env);
const SUN = Date.UTC(2026, 11, 6, 12); // Sunday 2026-12-06 12:00 UTC
const reg = (...names: string[]) => sql((s) => names.forEach((n, i) => s.exec("INSERT INTO bots (name_lc, name, key_hash, created_at) VALUES (?, ?, ?, 1)", n.toLowerCase(), n, `SECRETHASH${i}${n}`)));
const runCup = (t = SUN) => runInDurableObject(lobby(), async (o: Lobby) => o.runCup(t));
// Every test runs on a pinned clock before the first cup Sunday, so the lazy draw (GET, recordGame) never runs on the real date.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.UTC(2026, 10, 28, 12)); });
afterEach(() => vi.useRealTimers());
const scheduled = async (t = SUN) => {
  const ps: Promise<unknown>[] = [];
  (app as any).scheduled({ scheduledTime: t, cron: "0 12 * * SUN" }, env, { waitUntil: (p: Promise<unknown>) => ps.push(p) });
  await Promise.all(ps);
};

beforeEach(async () => {
  await sql((s) => { for (const t of ["bots", "ratings", "settled_games", "house_games", "bot_games", "unlisted_bots", "cup_runs", "cup_entries", "cup_pairings"]) s.exec(`DELETE FROM ${t}`); });
});

describe("pairRounds", () => {
  const E = (n: number) => Array.from({ length: n }, (_, i) => ({ lc: `b${i + 1}`, rating: 1300 - i * 10 }));
  const key = (p: { a: string; b: string | null }) => [p.a, p.b].sort().join("|");

  it("pairs by rating, deterministically", () => {
    expect(pairRounds(E(4))[0]).toEqual([{ a: "b1", b: "b2" }, { a: "b3", b: "b4" }]);
    expect(pairRounds([...E(4)].reverse())).toEqual(pairRounds(E(4)));
  });

  it("does not repeat a pairing when avoidable", () => {
    for (const n of [4, 6, 8]) {
      const keys = pairRounds(E(n)).flat().map(key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("gives an odd count a bye each round, to a different bot, lowest rated first", () => {
    const rounds = pairRounds(E(5));
    const byes = rounds.map((r) => r.find((p) => p.b === null)!.a);
    expect(byes[0]).toBe("b5");
    expect(new Set(byes).size).toBe(3);
    for (const r of rounds) expect(r.flatMap((p) => [p.a, p.b]).filter(Boolean).sort()).toEqual(["b1", "b2", "b3", "b4", "b5"]);
  });

  it("repeats the only pair when two enter, and pairs nobody when fewer than two", () => {
    expect(pairRounds(E(2)).flat().map(key)).toEqual(["b1|b2", "b1|b2", "b1|b2"]);
    expect(pairRounds(E(1))).toEqual([]);
  });
});

describe("scheduled cup", () => {
  const seed = async () => {
    await reg("Ada Bot", "Grace Bot", "Linus Bot", "Unlisted Bot");
    await sql((s) => s.exec("INSERT INTO unlisted_bots (name_lc) VALUES ('unlisted bot')"));
    const t = SUN - 86_400_000;
    await sql((s) => {
      for (const [n, r] of [["ada bot", 1250], ["grace bot", 1220], ["linus bot", 1200], ["unlisted bot", 1300], ["house (easy)", 1100]] as const) {
        s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, 'ttt', ?, 3, 1, 1, 1)", n, r);
        s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', 'guest', 'win', ?, ?)", n, r, t);
      }
      s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES ('ada bot', 'connect4', 1200, 1, 1, 0, 0)");
    });
  };

  it("writes the entrants and pairings once, leaving ratings alone, and is idempotent", async () => {
    await seed();
    const before = await sql((s) => s.exec("SELECT * FROM ratings ORDER BY name_lc, game_id").toArray());
    await scheduled();
    await scheduled();
    expect(await sql((s) => s.exec("SELECT game_id, entrants FROM cup_runs ORDER BY game_id").toArray())).toEqual([{ game_id: "connect4", entrants: 0 }, { game_id: "ttt", entrants: 3 }]);
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM cup_pairings").one().n)).toBe(6); // 3 rounds x (1 pair + 1 bye)
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM cup_entries").one().n)).toBe(3); // no unlisted bot, no house
    expect(await sql((s) => s.exec("SELECT * FROM ratings ORDER BY name_lc, game_id").toArray())).toEqual(before);
  });

  it("does not enter a bot that has not played in the last 7 days", async () => {
    await seed();
    await sql((s) => s.exec("UPDATE bot_games SET at = ? WHERE name_lc = 'linus bot'", SUN - 8 * 86_400_000));
    await runCup();
    expect(await sql((s) => s.exec("SELECT entrants FROM cup_runs WHERE game_id = 'ttt'").one().entrants)).toBe(2);
  });
});

describe("GET /api/arena/cup", () => {
  it("is empty, not an error, before the first cup", async () => {
    const r = await cup();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=10");
    expect(await r.json()).toEqual({ current: null, last: null });
  });

  it("counts points from the rated games the pairings produce: win 1, draw 0.5, bye 1, unplayed 0", async () => {
    await reg("Ada Bot", "Grace Bot", "Linus Bot");
    await sql((s) => {
      for (const [n, r] of [["ada bot", 1250], ["grace bot", 1220], ["linus bot", 1200]] as const) {
        s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, 'ttt', ?, 1, 1, 0, 0)", n, r);
        s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', 'guest', 'win', ?, ?)", n, r, SUN - 1000);
      }
    });
    await runCup();
    // Rounds by rating: R1 Ada-Grace (Linus bye), R2 Ada-Linus (Grace bye), R3 Grace-Linus (Ada bye).
    const g = (res: string, a: string, b: string, at: number) => sql((s) => {
      const flip: Record<string, string> = { win: "loss", loss: "win", draw: "draw" };
      s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', ?, ?, 1200, ?)", a.toLowerCase(), b, res, at);
      s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', ?, ?, 1200, ?)", b.toLowerCase(), a, flip[res], at);
    });
    await g("win", "Ada Bot", "Grace Bot", SUN + 1000);
    await g("draw", "Linus Bot", "Ada Bot", SUN + 2000);
    await g("win", "Ada Bot", "Grace Bot", SUN + 3000); // a second Ada-Grace game: no third round pairs them, so it is not counted
    await g("win", "Ada Bot", "Grace Bot", SUN + 8 * 86_400_000); // after the cup's 7 days
    const body = (await (await cup()).json()) as any;
    expect(body.last).toBeNull();
    expect(body.current.week).toBe("2026-12-06");
    const t = body.current.games.ttt;
    expect(t.entrants).toBe(3);
    expect(t.table).toEqual([
      { name: "Ada Bot", points: 2.5, games: 2, results: ["win", "draw", "bye"], opponents: ["Grace Bot", "Linus Bot", null] },
      { name: "Linus Bot", points: 1.5, games: 1, results: ["bye", "draw", "pending"], opponents: [null, "Ada Bot", "Grace Bot"] },
      { name: "Grace Bot", points: 1, games: 1, results: ["loss", "bye", "pending"], opponents: ["Ada Bot", null, "Linus Bot"] },
    ]);
    expect(t.winner).toEqual({ name: "Ada Bot", points: 2.5 });
  });

  it("shows last week's winner and this week's table, and the Fewer-than-2 case", async () => {
    await reg("Ada Bot");
    await sql((s) => s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES ('ada bot', 'ttt', 1200, 1, 1, 0, 0)"));
    await sql((s) => s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES ('ada bot', 'ttt', 'guest', 'win', 1200, ?)", SUN - 5000));
    await runCup(SUN - 7 * 86_400_000 + 1);
    await runCup();
    const body = (await (await cup()).json()) as any;
    expect(body.current.games.ttt).toEqual({ entrants: 1, table: [], winner: null });
    expect(body.last.week).toBe("2026-11-29");
    expect(body.last.games.ttt).toEqual({ entrants: 0, table: [], winner: null }); // Ada's game came after that draw
  });

  it("leaks no internal ids, hashes or socket ids", async () => {
    await reg("Ada Bot", "Grace Bot");
    vi.setSystemTime(SUN - 1000);
    await play("g1", "ttt", "Ada Bot", "Grace Bot", 1);
    await runCup();
    const text = await (await cup()).text();
    expect(text).toContain("Ada Bot");
    for (const bad of ["SECRETHASH", "key_hash", "sid", "clientId", "socketId", "replay", "name_lc", "bot_game_id", "g1"]) expect(text).not.toContain(bad);
    expect(Object.keys(JSON.parse(text).current.games.ttt.table[0]).sort()).toEqual(["games", "name", "opponents", "points", "results"]);
  });

  it("does not let the name Cup shadow the route: registering it is refused", async () => {
    const r = await runInDurableObject(lobby(), async (o: Lobby) => o.registerBot("Cup", "1.2.3.4"));
    expect(r.status).toBe(409);
  });
});

describe("cup drawn without a cron (the free plan's 5 cron triggers are taken)", () => {
  const DAY = 86_400_000;
  it("draws for the latest Sunday 12:00 UTC at or before now", () => {
    expect(cupDrawTime(SUN)).toBe(SUN);
    expect(cupDrawTime(SUN - 1)).toBe(SUN - 7 * DAY);
    expect(cupDrawTime(SUN + 3 * DAY + 5)).toBe(SUN);
  });

  it("the first rated game after Sunday noon draws the cup before it is rated, from the week before only", async () => {
    await reg("Ada Bot", "Grace Bot", "Linus Bot");
    await sql((s) => {
      for (const [n, r] of [["ada bot", 1250], ["grace bot", 1220]] as const) {
        s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, 'ttt', ?, 1, 1, 0, 0)", n, r);
        s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', 'guest', 'win', ?, ?)", n, r, SUN - DAY);
      }
    });
    vi.setSystemTime(SUN + 1000);
    await play("lazy1", "ttt", "Ada Bot", "Linus Bot", 1); // Linus first plays after the draw: not an entrant
    expect(await sql((s) => s.exec("SELECT week, game_id, entrants FROM cup_runs ORDER BY week").toArray())).toEqual([{ week: "2026-11-29", game_id: "ttt", entrants: 0 }, { week: "2026-12-06", game_id: "ttt", entrants: 2 }]);
    expect(await sql((s) => s.exec("SELECT name_lc, rating FROM cup_entries ORDER BY name_lc").toArray())).toEqual([{ name_lc: "ada bot", rating: 1250 }, { name_lc: "grace bot", rating: 1220 }]);
    await play("lazy2", "ttt", "Ada Bot", "Grace Bot", 1);
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM cup_runs").one().n)).toBe(2); // drawn once each
    const t = ((await (await cup()).json()) as any).current.games.ttt.table;
    expect(t[0]).toEqual({ name: "Ada Bot", points: 1, games: 1, results: ["win", "pending", "pending"], opponents: ["Grace Bot", "Grace Bot", "Grace Bot"] });
  });

  it("a quiet week does not lose its cup: the first visit after it draws the missed Sunday too", async () => {
    await reg("Ada Bot", "Grace Bot");
    await sql((s) => {
      for (const n of ["ada bot", "grace bot"]) {
        s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, 'ttt', 1200, 1, 1, 0, 0)", n);
        s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, 'ttt', 'guest', 'win', 1200, ?)", n, SUN - DAY);
      }
    });
    vi.setSystemTime(SUN + 7 * DAY + 5); // nothing ran from before SUN until a week later
    const body = (await (await cup()).json()) as any;
    expect([body.current.week, body.last.week]).toEqual(["2026-12-13", "2026-12-06"]);
    expect(body.last.games.ttt.entrants).toBe(2);
  });

  it("the cron path keeps the first-cup guard", async () => {
    await reg("Ada Bot");
    await sql((s) => s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES ('ada bot', 'ttt', 1200, 1, 1, 0, 0)"));
    await scheduled(Date.UTC(2026, 10, 22, 12)); // a Sunday before the first cup
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM cup_runs").one().n)).toBe(0);
  });

  it("a cup page visit after Sunday noon draws it too; nothing is drawn before the first cup Sunday", async () => {
    await reg("Ada Bot");
    await sql((s) => s.exec("INSERT INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES ('ada bot', 'ttt', 1200, 1, 1, 0, 0)"));
    // the pinned clock: Saturday 2026-11-28, before the first cup (2026-11-29)
    expect(await (await cup()).json()).toEqual({ current: null, last: null });
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM cup_runs").one().n)).toBe(0);
    vi.setSystemTime(SUN + 5);
    const body = (await (await cup()).json()) as any;
    expect(body.current.week).toBe("2026-12-06");
  });
});

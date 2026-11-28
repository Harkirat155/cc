import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

let ipN = 0;
const register = (body: unknown) =>
  app.fetch(new Request("http://x/api/bots", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": `10.1.0.${++ipN}` }, body: JSON.stringify(body) }), env);
const get = async (path: string) => (await app.fetch(new Request(`http://x${path}`), env)).json() as Promise<any>;
const sql = <T>(fn: (s: any) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => fn(st.storage.sql));
const play = (id: string, a: string, b: string | null, score: 0 | 0.5 | 1) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (o: Lobby) => o.recordGame(id, "ttt", a, b, score));

beforeEach(async () => { await sql((s) => { for (const t of ["bots", "ratings", "settled_games", "house_games", "bot_games", "bot_reg", "unlisted_bots"]) s.exec(`DELETE FROM ${t}`); }); });

describe("unlisted bots", () => {
  it("registers with unlisted:true, rates normally, and stays off the leaderboard and the feed", async () => {
    expect((await register({ name: "Shown Bot" })).status).toBe(201);
    expect((await register({ name: "Hidden Bot", unlisted: true })).status).toBe(201);
    await play("g1", "Shown Bot", "Hidden Bot", 1);
    const lb = await get("/api/arena");
    expect(lb.games.ttt.map((r: any) => r.name)).toEqual(["Shown Bot"]);
    const feed = await get("/api/arena-feed");
    expect(feed.feed.map((r: any) => r.name)).toEqual(["Shown Bot"]);
    const row = await sql((s) => s.exec("SELECT rating, games FROM ratings WHERE name_lc = 'hidden bot'").one());
    expect(row.games).toBe(1);
    expect(row.rating).toBeLessThan(1200);
  });

  it("keeps the unlisted bot's own page and badge working, flagged as unlisted", async () => {
    await register({ name: "Hidden Bot", unlisted: true });
    await play("g1", "Hidden Bot", null, 1);
    const page = await get("/api/arena/Hidden%20Bot");
    expect(page.unlisted).toBe(true);
    expect(page.games).toHaveLength(1);
    const badge = await app.fetch(new Request("http://x/api/arena/badge/Hidden%20Bot.svg?game=ttt"), env);
    expect(await badge.text()).toContain("1216");
    await register({ name: "Plain Bot" });
    expect((await get("/api/arena/Plain%20Bot")).unlisted).toBeUndefined();
  });

  it("treats a non-true unlisted value as listed", async () => {
    await register({ name: "Str Bot", unlisted: "yes" });
    expect(await sql((s) => s.exec("SELECT COUNT(*) AS n FROM unlisted_bots").one().n)).toBe(0);
  });

  it("seeds the two operator smoke bots as unlisted in a fresh Lobby", async () => {
    const stub = (env as any).LOBBY.getByName("fresh-seed");
    await runInDurableObject(stub, async (_o: Lobby, st) => {
      const names = st.storage.sql.exec("SELECT name_lc FROM unlisted_bots ORDER BY name_lc").toArray().map((r: any) => r.name_lc);
      expect(names).toEqual(["smokehouse14206", "smokerecent42775"]);
    });
  });
});

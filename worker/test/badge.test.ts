import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

const sql = <T>(fn: (s: any) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => fn(st.storage.sql));
const badge = (name: string, q = "?game=connect4", ext = ".svg") => app.fetch(new Request(`http://x/api/arena/badge/${name}${ext}${q}`), env);
const seed = (name: string, game: string, rating: number) =>
  sql((s) => {
    s.exec("INSERT OR REPLACE INTO bots (name, name_lc, key_hash, created_at) VALUES (?, ?, ?, 0)", name, name.toLowerCase(), `h${name}`);
    s.exec("INSERT OR REPLACE INTO ratings (name_lc, game_id, rating, games, wins, draws, losses) VALUES (?, ?, ?, 1, 1, 0, 0)", name.toLowerCase(), game, rating);
  });

beforeEach(async () => { await sql((s) => { s.exec("DELETE FROM bots"); s.exec("DELETE FROM ratings"); }); });

describe("GET /api/arena/badge/:name.svg", () => {
  it("renders a rated bot, matching the name case-insensitively, with the cache header", async () => {
    await seed("Alpha Bot", "connect4", 1216.4);
    const r = await badge("alpha%20bot");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("image/svg+xml");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const svg = await r.text();
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("CrissCross Connect Four");
    expect(svg).toContain("1216");
    expect(svg).toContain("<title>");
    expect(svg).toContain("plays on this server");
    expect(svg).not.toMatch(/key|hash/i);
  });

  it("rates per game type", async () => {
    await seed("Beta", "ttt", 1300);
    expect(await (await badge("Beta", "?game=ttt")).text()).toContain("1300");
    expect(await (await badge("Beta", "?game=checkers")).text()).toContain("unrated");
  });

  it("returns a grey unrated badge with 200 for an unknown bot", async () => {
    const r = await badge("Nobody");
    expect(r.status).toBe(200);
    const svg = await r.text();
    expect(svg).toContain("CrissCross Connect Four");
    expect(svg).toContain("unrated");
    expect(svg).toContain("#9f9f9f");
    expect(r.headers.get("content-type")).toContain("image/svg+xml");
    expect(r.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("accepts .SVG in any case; a missing or other suffix is 404", async () => {
    await seed("Gamma", "ttt", 1210);
    expect(await (await badge("Gamma", "?game=ttt", ".SVG")).text()).toContain("1210");
    expect((await badge("Gamma", "?game=ttt", "")).status).toBe(404);
    expect((await badge("Gamma", "?game=ttt", ".png")).status).toBe(404);
  });

  it("decodes the name once, and a malformed escape is unrated 200", async () => {
    await seed("a%41", "ttt", 1230);
    expect(await (await badge("a%2541", "?game=ttt")).text()).toContain("1230");
    const r = await badge("%zz", "?game=ttt");
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("unrated");
  });

  it("returns 400 for a missing or unknown game", async () => {
    expect((await badge("Beta", "?game=chess")).status).toBe(400);
    expect((await badge("Beta", "")).status).toBe(400);
  });

  it("escapes markup in the name and text", async () => {
    const evil = `a<b>&"'`;
    await seed(evil, "ttt", 1250);
    const svg = await (await badge(encodeURIComponent(evil), "?game=ttt")).text();
    expect(svg).toContain("a&lt;b&gt;&amp;&quot;&apos;");
    expect(svg).not.toContain("<b>");
    expect(svg).not.toContain(evil);
    expect((svg.match(/<svg /g) ?? []).length).toBe(1);
  });
});

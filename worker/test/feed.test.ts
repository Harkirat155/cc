import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

const feed = (method = "GET") => app.fetch(new Request("http://x/api/arena-feed", { method }), env);
const sql = <T>(fn: (s: any) => T) => runInDurableObject((env as any).LOBBY.getByName("lobby"), async (_o: Lobby, st) => fn(st.storage.sql));
const row = (name_lc: string, game_id: string, result: string, rating: number, at: number) =>
  sql((s) => s.exec("INSERT INTO bot_games (name_lc, game_id, opponent, result, rating_after, at) VALUES (?, ?, 'guest', ?, ?, ?)", name_lc, game_id, result, rating, at));

beforeEach(async () => { await sql((s) => { for (const t of ["bots", "bot_games"]) s.exec(`DELETE FROM ${t}`); }); });

describe("GET /api/arena-feed", () => {
  it("is an empty list, not an error, when nothing has finished", async () => {
    const r = await feed();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ feed: [] });
  });

  it("lists the last 20 rated games newest first, one row per bot side, names and numbers only", async () => {
    await sql((s) => s.exec("INSERT INTO bots (name_lc, name, key_hash, created_at) VALUES ('ada bot', 'Ada Bot', 'SECRETHASH', 1)"));
    for (let i = 0; i < 22; i++) await row(i === 21 ? "ada bot" : "other bot", "ttt", "win", 1200.4 + i, 1000 + i);
    await row("ada bot", "connect4", "loss", 1190.6, 2000);
    const r = await feed();
    expect(r.headers.get("cache-control")).toBe("public, max-age=10");
    const body = (await r.json()) as { feed: any[] };
    expect(body.feed).toHaveLength(20);
    expect(body.feed[0]).toEqual({ name: "Ada Bot", gameId: "connect4", result: "loss", ratingAfter: 1191, at: 2000 });
    expect(body.feed[1].name).toBe("Ada Bot");
    expect(body.feed[2].name).toBe("other bot");
    expect(body.feed.at(-1).at).toBe(1003);
    expect(JSON.stringify(body)).not.toContain("SECRETHASH");
  });

  it("is GET only", async () => {
    expect((await feed("POST")).status).toBe(404);
  });
});

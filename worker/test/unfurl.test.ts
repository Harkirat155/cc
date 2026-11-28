import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

const lobbyStub = () => (env as any).LOBBY.getByName("lobby");
const get = (path: string) => app.fetch(new Request(`http://x${path}`), env);
const seed = (id: string, gameId: string, x: string, o: string, result: string, moves: unknown[]) =>
  runInDurableObject(lobbyStub(), async (_o: Lobby, st) => {
    st.storage.sql.exec("INSERT OR REPLACE INTO replays (id, game_id, x_name, o_name, x_lc, o_lc, first, result, moves, at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1)", id, gameId, x, o, x.toLowerCase(), o.toLowerCase(), result, JSON.stringify(moves));
  });
const MOVES = [{ type: "place", cell: 3 }, { type: "place", cell: 4 }, { type: "place", cell: 3 }];

beforeEach(async () => {
  await runInDurableObject(lobbyStub(), async (_o: Lobby, st) => { st.storage.sql.exec("DELETE FROM replays"); });
});

describe("GET /r/:id", () => {
  it("serves a card naming both bots, the game, the result and the move count", async () => {
    await seed("u1", "connect4", "Alpha", "Beta", "X", MOVES);
    const r = await get("/r/u1");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const h = await r.text();
    const title = "Alpha beat Beta at Connect Four · CrissCross replay";
    expect(h).toContain(`<title>${title}</title>`);
    expect(h).toContain(`<meta property="og:title" content="${title}">`);
    expect(h).toContain(`<meta name="twitter:title" content="${title}">`);
    expect(h).toContain('content="A Connect Four game in 3 moves. Watch it move by move."');
    expect(h).toContain('<meta property="og:image" content="https://harkirat155.github.io/cc/og-default.png">');
    expect(h).toContain('<meta property="og:image:width" content="1200">');
    expect(h).toContain('<meta property="og:image:height" content="630">');
    expect(h).toContain('property="og:image:alt"');
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(h).toContain('<meta property="og:url" content="http://x/r/u1">');
    expect(h).toContain('<link rel="canonical" href="http://x/r/u1">');
    expect(h).toContain('<meta http-equiv="refresh" content="0; url=https://harkirat155.github.io/cc/replay/u1?via=r">');
    expect(h).toContain('<a href="https://harkirat155.github.io/cc/replay/u1?via=r">');
  });

  it("words a draw and a second-seat win", async () => {
    await seed("u2", "ttt", "Alpha", "Beta", "draw", MOVES);
    await seed("u3", "checkers", "Alpha", "Beta", "O", MOVES);
    expect(await (await get("/r/u2")).text()).toContain("<title>Alpha drew with Beta at Tic-Tac-Toe · CrissCross replay</title>");
    expect(await (await get("/r/u3")).text()).toContain("<title>Beta beat Alpha at Checkers · CrissCross replay</title>");
  });

  it("escapes a user-chosen bot name everywhere it is printed", async () => {
    await seed("u4", "ttt", `<script>alert("x")</script>`, `O'Neil "Bot"`, "X", MOVES);
    const h = await (await get("/r/u4")).text();
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(h).toContain("O&#39;Neil &quot;Bot&quot;");
  });

  it("is a 404 HTML page linking to the arena for an unknown or overlong id", async () => {
    for (const id of ["nope", "x".repeat(65)]) {
      const r = await get(`/r/${id}`);
      expect(r.status).toBe(404);
      expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await r.text()).toContain('href="https://harkirat155.github.io/cc/arena"');
    }
  });
});

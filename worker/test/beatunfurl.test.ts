import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";

// A Rush challenge card carries only the number in the link: touching either Durable Object namespace is a failure.
const untouchable = new Proxy({}, { get: () => { throw new Error("a Durable Object binding was touched"); } });
const get = (path: string) => app.fetch(new Request(`http://x${path}`), { ...env, LOBBY: untouchable, ROOM: untouchable } as typeof env);

describe("GET /b/:n", () => {
  it("serves a card that names the number, then sends the browser to Rush with ?via=b", async () => {
    const r = await get("/b/7");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const h = await r.text();
    const title = "Beat 7 in today&#39;s Puzzle Rush · CrissCross";
    expect(h).toContain(`<title>${title}</title>`);
    expect(h).toContain(`<meta property="og:title" content="${title}">`);
    expect(h).toContain(`<meta name="twitter:title" content="${title}">`);
    const desc = "Solve more than 7 puzzles to beat it. Solve as many puzzles as you can in 3 minutes, across Tic-Tac-Toe, Connect Four, Five in a Row and Checkers. Same run for everyone today.";
    expect(h).toContain(`<meta property="og:description" content="${desc}">`);
    expect(h).toContain('<meta property="og:url" content="http://x/b/7">');
    expect(h).toContain('<meta property="og:image" content="https://harkirat155.github.io/cc/og-default.png">');
    expect(h).toContain('<meta http-equiv="refresh" content="0; url=https://harkirat155.github.io/cc/rush/?beat=7&amp;via=b">');
  });

  it("takes 1 to 999", async () => {
    expect(await (await get("/b/1")).text()).toContain("Solve more than 1 puzzle to beat it.");
    expect(await (await get("/b/999")).text()).toContain("<title>Beat 999 in today&#39;s");
  });

  it("is a 404 no-store page that links to Rush for anything else", async () => {
    for (const n of ["0", "1000", "01", "abc", "7x", "%3Cscript%3E", "-3", "1.5"]) {
      const r = await get(`/b/${n}`);
      expect(r.status, n).toBe(404);
      expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(r.headers.get("cache-control")).toBe("no-store");
      const h = await r.text();
      expect(h).toContain('href="https://harkirat155.github.io/cc/rush/"');
      expect(h).not.toContain("<script>");
    }
  });
});

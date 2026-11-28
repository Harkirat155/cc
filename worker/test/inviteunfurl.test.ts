import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";

// A room link card carries only what the link carries: touching either Durable Object namespace is a failure.
const untouchable = new Proxy({}, { get: () => { throw new Error("a Durable Object binding was touched"); } });
const get = (path: string) => app.fetch(new Request(`http://x${path}`), { ...env, LOBBY: untouchable, ROOM: untouchable } as typeof env);

describe("GET /j/:roomId", () => {
  it("serves a card titled by the game, then sends the browser to the room with ?via=j", async () => {
    const r = await get("/j/ABCDE?g=connect4");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const h = await r.text();
    const title = "Join my Connect Four game · CrissCross";
    expect(h).toContain(`<title>${title}</title>`);
    expect(h).toContain(`<meta property="og:title" content="${title}">`);
    expect(h).toContain(`<meta name="twitter:title" content="${title}">`);
    expect(h).toContain("Room ABCDE. Open the link to take the other seat, or watch if it&#39;s full.");
    expect(h).toContain('<meta property="og:image" content="https://harkirat155.github.io/cc/og-default.png">');
    expect(h).toContain('<meta property="og:url" content="http://x/j/ABCDE?g=connect4">');
    expect(h).toContain('<meta http-equiv="refresh" content="0; url=https://harkirat155.github.io/cc/room/ABCDE?via=j">');
    expect(h).toContain('<a href="https://harkirat155.github.io/cc/room/ABCDE?via=j">');
  });

  it("uses the registry name for each game, and takes a lower-case room code", async () => {
    for (const [g, name] of [["ttt", "Tic-Tac-Toe"], ["checkers", "Checkers"], ["five", "Five in a Row"]]) {
      expect(await (await get(`/j/abcde?g=${g}`)).text()).toContain(`<title>Join my ${name} game · CrissCross</title>`);
    }
    expect(await (await get("/j/abcde?g=ttt")).text()).toContain("room/ABCDE?via=j");
  });

  it("gives the generic title for a missing or unknown game, and never echoes the value", async () => {
    for (const q of ["", "?g=chess", "?g=%3Cscript%3E", "?g=constructor"]) {
      const h = await (await get(`/j/ABCDE${q}`)).text();
      expect(h, q).toContain("<title>Join a game on CrissCross</title>");
      expect(h).not.toContain("<script>");
      expect(h).not.toContain("chess");
    }
  });

  it("is a 404 no-store page for a room code that is not 5 letters or digits", async () => {
    for (const id of ["ABCD", "ABCDEF", "AB%20DE", "%3Cscript%3E", "AB-DE"]) {
      const r = await get(`/j/${id}?g=connect4`);
      expect(r.status, id).toBe(404);
      expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(r.headers.get("cache-control")).toBe("no-store");
      const h = await r.text();
      expect(h).toContain('href="https://harkirat155.github.io/cc/lobby"');
      expect(h).not.toContain("<script>");
    }
  });
});

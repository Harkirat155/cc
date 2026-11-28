import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";

const get = (path: string) => app.fetch(new Request(`http://x${path}`), env);

describe("GET /d/:date", () => {
  it("serves a card naming the date, then sends the browser to /daily/2026-11-28?via=d", async () => {
    const r = await get("/d/2026-11-28");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const h = await r.text();
    const title = "CrissCross Daily 2026-11-28 · a friend solved it";
    expect(h).toContain(`<title>${title}</title>`);
    expect(h).toContain(`<meta property="og:title" content="${title}">`);
    expect(h).toContain(`<meta name="twitter:title" content="${title}">`);
    expect(h).toContain('content="A friend solved the 2026-11-28 Connect Four puzzle. Can you?"');
    expect(h).toContain('<meta property="og:image" content="https://harkirat155.github.io/cc/og-daily.png">');
    expect(h).toContain('<meta property="og:url" content="http://x/d/2026-11-28">');
    expect(h).toContain('<meta http-equiv="refresh" content="0; url=https://harkirat155.github.io/cc/daily/2026-11-28?via=d">');
    expect(h).toContain('<a href="https://harkirat155.github.io/cc/daily/2026-11-28?via=d">');
  });

  it("is a 404 no-store HTML page for a malformed, impossible or out-of-range date", async () => {
    for (const d of ["nope", "2026-13-01", "2026-02-30", "2026-1-5", "2026-11-28x", "1999-01-01", "2026-11-26", "2999-01-01", new Date(Date.now() + 86400000).toISOString().slice(0, 10), "%3Cscript%3E"]) {
      const r = await get(`/d/${d}`);
      expect(r.status, d).toBe(404);
      expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(r.headers.get("cache-control")).toBe("no-store");
      const h = await r.text();
      expect(h).toContain('href="https://harkirat155.github.io/cc/daily"');
      expect(h).not.toContain("<script>");
    }
  });
});

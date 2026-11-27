import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import type { Lobby } from "../src/lobby";

const LOBBY = (env as unknown as { LOBBY: DurableObjectNamespace<Lobby> }).LOBBY;

// Parity with the Express route, server/app.js:103-170, and express.json, app.js:73-81.
const post = (body: BodyInit | null, headers: Record<string, string> = { "Content-Type": "application/json" }) =>
  app.fetch(new Request("http://x/feedback", { method: "POST", body, headers }), env);
const postJson = (obj: unknown, headers?: Record<string, string>) => post(JSON.stringify(obj), headers);

const RATING_ERR = { error: "Rating must be a number between 1 and 5." };
const MESSAGE_ERR = { error: "Feedback should be at least 5 characters long." };
const PARSE_ERR = { error: "Invalid JSON payload." };

describe("POST /feedback", () => {
  it("returns 201 with status, id and sheetsSync, key for key", async () => {
    const res = await postJson({ rating: 4, message: "  great game  " });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(["id", "sheetsSync", "status"]);
    expect(body.status).toBe("received");
    expect(body.sheetsSync).toBe("skipped");
    expect(body.id).toMatch(/^[0-9a-z]+-[0-9a-z]{1,6}$/);
  });

  it.each([
    ["rating 0", { rating: 0, message: "hello there" }, RATING_ERR],
    ["rating 6", { rating: 6, message: "hello there" }, RATING_ERR],
    ["rating NaN string", { rating: "abc", message: "hello there" }, RATING_ERR],
    ["rating missing", { message: "hello there" }, RATING_ERR],
    ["rating null", { rating: null, message: "hello there" }, RATING_ERR],
    ["message missing", { rating: 3 }, MESSAGE_ERR],
    ["message not a string", { rating: 3, message: 12345 }, MESSAGE_ERR],
    ["message too short after trim", { rating: 3, message: "  abc  " }, MESSAGE_ERR],
  ])("400 for %s", async (_n, payload, expected) => {
    const res = await postJson(payload);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expected);
  });

  it("rating is checked before message", async () => {
    expect(await (await postJson({ rating: 9, message: "x" })).json()).toEqual(RATING_ERR);
  });

  it("coerces like Number(): numeric string and boolean true are accepted", async () => {
    expect((await postJson({ rating: "3", message: "hello there" })).status).toBe(201);
    expect((await postJson({ rating: true, message: "hello there" })).status).toBe(201);
  });

  it("non-JSON content type: body ignored, so 400 on rating (express.json skips it)", async () => {
    const res = await post("rating=4&message=hello", { "Content-Type": "text/plain" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(RATING_ERR);
  });

  it("empty JSON body is {}: 400 on rating", async () => {
    const res = await post("");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(RATING_ERR);
  });

  it.each(["{not json", "null", '"str"', "42", "   "])("malformed or non-object JSON %j: 400 Invalid JSON payload", async (raw) => {
    const res = await post(raw);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(PARSE_ERR);
  });

  it("JSON array body: 400 on rating (strict mode allows arrays)", async () => {
    const res = await post("[1,2]");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(RATING_ERR);
  });

  it("accepts a body of exactly 32kb and rejects one byte more with 413", async () => {
    const make = (n: number) => {
      const head = '{"rating":4,"message":"hello there","pad":"';
      const tail = '"}';
      return head + "a".repeat(n - head.length - tail.length) + tail;
    };
    expect((await post(make(32 * 1024))).status).toBe(201);
    const res = await post(make(32 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    expect(await res.text()).toContain("<pre>Payload Too Large</pre>");
  });

  it("oversize is enforced on a streamed body without Content-Length", async () => {
    const chunk = new TextEncoder().encode("a".repeat(1024));
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"rating":4,"message":"hello","p":"'));
        for (let i = 0; i < 40; i++) c.enqueue(chunk);
        c.enqueue(new TextEncoder().encode('"}'));
        c.close();
      },
    });
    const res = await app.fetch(
      new Request("http://x/feedback", {
        method: "POST",
        body: stream,
        headers: { "Content-Type": "application/json" },
        // @ts-expect-error duplex is required for stream bodies
        duplex: "half",
      }),
      env,
    );
    expect(res.status).toBe(413);
  });
});

describe("feedback persistence (Lobby DO SQLite)", () => {
  it("stores the sanitised row returned by the route id", async () => {
    const res = await postJson(
      {
        rating: 4.26,
        message: "  stored message  ",
        context: { roomId: "r".repeat(40), isMultiplayer: true, socketId: 5, url: "https://u" },
      },
      { "Content-Type": "application/json", Origin: "https://a.example", "User-Agent": "ua/1" },
    );
    const { id } = (await res.json()) as { id: string };
    const rows = await LOBBY.getByName("lobby").listFeedback(500);
    const row = rows.find((r) => r.id === id)!;
    expect(row.rating).toBe(4.3);
    expect(row.message).toBe("stored message");
    expect(row.context).toEqual({ roomId: "r".repeat(32), isMultiplayer: true, url: "https://u" });
    expect(row.meta).toEqual({ origin: "https://a.example", userAgent: "ua/1" });
    expect(typeof row.receivedAt).toBe("string");
  });

  it("trims to the newest 200", async () => {
    const stub = LOBBY.getByName("trim-test");
    for (let i = 0; i < 205; i++) await stub.addFeedback({ rating: 3, message: `message ${i}` });
    const rows = await stub.listFeedback(500);
    expect(rows).toHaveLength(200);
    expect(rows[0].message).toBe("message 204");
    expect(rows[199].message).toBe("message 5");
  });
});

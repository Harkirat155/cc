import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { appendFeedbackRow, sheetsConfigured } from "../src/sheets";

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

let pem: string;
let publicKey: CryptoKey;
beforeAll(async () => {
  const kp = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  publicKey = kp.publicKey;
  const der = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  pem = `-----BEGIN PRIVATE KEY-----\n${b64(der as ArrayBuffer).match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
});

// Each test uses its own email: the token cache is module-scoped and keyed by email.
let n = 0;
const mk = (extra: Record<string, string> = {}) => ({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: `sa${++n}@proj.iam.gserviceaccount.com`,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: pem,
  GOOGLE_SHEETS_SPREADSHEET_ID: "sheet123",
  ...extra,
});
const ROW = { timestamp: "2026-01-02T03:04:05.000Z", rating: 4.5, message: "great game", context: { roomId: "r1" }, meta: { ip: "1.2.3.4" } };

type Call = { url: string; init: RequestInit };
function stubFetch(tokenStatus = 200, appendStatus = 200) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init: init ?? {} });
    if (url === "https://oauth2.googleapis.com/token") {
      return tokenStatus === 200
        ? Response.json({ access_token: "tok-abc", expires_in: 3600 })
        : new Response("boom", { status: tokenStatus });
    }
    return new Response("{}", { status: appendStatus });
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe("sheetsConfigured", () => {
  it("needs email, key and spreadsheet id", () => {
    const full = mk();
    expect(sheetsConfigured(full)).toBe(true);
    expect(sheetsConfigured({ ...full, GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined })).toBe(false);
    expect(sheetsConfigured({ ...full, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "" })).toBe(false);
    expect(sheetsConfigured({ ...full, GOOGLE_SHEETS_SPREADSHEET_ID: undefined })).toBe(false);
  });
});

describe("appendFeedbackRow", () => {
  it("(a) sends a JWT whose signature verifies, with the right claims", async () => {
    const calls = stubFetch();
    const e = mk();
    await appendFeedbackRow(e, ROW);
    const tokenCall = calls[0];
    expect(tokenCall.init.method).toBe("POST");
    const form = new URLSearchParams(tokenCall.init.body as string);
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [h, c, s] = form.get("assertion")!.split(".");
    expect(h + c + s).not.toMatch(/[+/=]/);
    expect(JSON.parse(new TextDecoder().decode(unb64url(h)))).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(new TextDecoder().decode(unb64url(c)));
    expect(claims.iss).toBe(e.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets");
    expect(claims.exp - claims.iat).toBe(3600);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, unb64url(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it("(b) appends with exact URL, method, Bearer header and five columns", async () => {
    const calls = stubFetch();
    expect(await appendFeedbackRow(mk(), ROW)).toEqual({ success: true });
    const a = calls[1];
    expect(a.url).toBe(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet123/values/Feedback!A%3AE:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    );
    expect(a.init.method).toBe("POST");
    expect(new Headers(a.init.headers).get("authorization")).toBe("Bearer tok-abc");
    expect(JSON.parse(a.init.body as string)).toEqual({
      values: [["2026-01-02T03:04:05.000Z", 4.5, "great game", '{"roomId":"r1"}', '{"ip":"1.2.3.4"}']],
    });
  });

  it("(b) honours a custom range and blanks missing context and meta", async () => {
    const calls = stubFetch();
    await appendFeedbackRow(mk({ GOOGLE_SHEETS_FEEDBACK_RANGE: "Tab 2!A:E" }), { timestamp: "t", rating: 1, message: "m" });
    expect(calls[1].url).toContain("/values/Tab%202!A%3AE:append");
    expect(JSON.parse(calls[1].init.body as string).values).toEqual([["t", 1, "m", "", ""]]);
  });

  it("(c) reuses the cached token for a second append", async () => {
    const calls = stubFetch();
    const e = mk();
    await appendFeedbackRow(e, ROW);
    await appendFeedbackRow(e, ROW);
    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(1);
    expect(calls.filter((c) => c.url.includes("sheets.googleapis")).length).toBe(2);
  });

  it("(c) refreshes the token once it is within 60 s of expiry", async () => {
    const calls = stubFetch();
    const e = mk();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await appendFeedbackRow(e, ROW);
    clock.mockReturnValue(now + 3541 * 1000);
    await appendFeedbackRow(e, ROW);
    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(2);
  });

  it("(d) a token-call 500 is a failure, not a throw, and no append is sent", async () => {
    const calls = stubFetch(500);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await appendFeedbackRow(mk(), ROW)).toEqual({ success: false });
    expect(calls.length).toBe(1);
    expect(err).toHaveBeenCalled();
  });

  it("(d) an append 403 is a failure, logged with the status only", async () => {
    stubFetch(200, 403);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await appendFeedbackRow(mk(), ROW)).toEqual({ success: false });
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).toContain("403");
    expect(logged).not.toContain("tok-abc");
  });

  it("(d) a fetch that throws is a failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await appendFeedbackRow(mk(), ROW)).toEqual({ success: false });
  });

  it("(d) a malformed key is a failure and never logs the key", async () => {
    const calls = stubFetch();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await appendFeedbackRow(mk({ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "not-a-key" }), ROW)).toEqual({ success: false });
    expect(calls.length).toBe(0);
    expect(err.mock.calls.flat().join(" ")).not.toContain("not-a-key");
  });

  it("(e) accepts a key whose newlines are literal backslash-n", async () => {
    const calls = stubFetch();
    const literal = pem.trim().replace(/\n/g, "\\n");
    expect(literal).not.toContain("\n");
    expect(await appendFeedbackRow(mk({ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: literal }), ROW)).toEqual({ success: true });
    expect(calls.length).toBe(2);
  });
});

describe("POST /feedback sheets sync", () => {
  const post = (e: object) =>
    app.fetch(
      new Request("http://x/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4, message: "great game", context: { roomId: "r9" } }),
      }),
      { ...env, ...e } as typeof env,
      { waitUntil: (p: Promise<unknown>) => void waits.push(p), passThroughOnException() {} } as unknown as ExecutionContext,
    );
  const waits: Promise<unknown>[] = [];

  it("(f) configured: 201 queued, and the row is appended with the stored receivedAt", async () => {
    const calls = stubFetch();
    waits.length = 0;
    const res = await post(mk());
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, string>;
    expect(body.sheetsSync).toBe("queued");
    await Promise.all(waits);
    const row = JSON.parse(calls.find((c) => c.url.includes("sheets.googleapis"))!.init.body as string).values[0];
    expect(row[0]).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
    expect(row.slice(1, 3)).toEqual([4, "great game"]);
  });

  it("(f) unconfigured: skipped and no fetch", async () => {
    const calls = stubFetch();
    const res = await post({});
    expect(((await res.json()) as Record<string, string>).sheetsSync).toBe("skipped");
    expect(calls.length).toBe(0);
  });
});

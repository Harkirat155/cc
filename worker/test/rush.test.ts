import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { rushPuzzle, rushSolve } from "../../shared/rush.js";

const DAY = "2026-11-28";
const lobby = () => (env as any).LOBBY.getByName("lobby");
const call = (path: string, body?: unknown, raw?: string) =>
  app.fetch(new Request(`http://x${path}`, body === undefined && raw === undefined ? undefined : { method: "POST", body: raw ?? JSON.stringify(body) }), env);
const start = async () => (await (await call("/api/rush/start", {})).json()) as { id: string; day: string };
const best = async () => (await (await call("/api/rush/best")).json()) as { day: string; best: number | null };
const solved = (n: number) => Array.from({ length: n }, (_, k) => rushSolve(rushPuzzle(DAY, k)));

// The clock is pinned through Date, the seam the other Worker tests use.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DAY}T12:00:00Z`));
  await runInDurableObject(lobby(), async (_o, st) => { st.storage.sql.exec("DELETE FROM rush_runs"); st.storage.sql.exec("DELETE FROM rush_best"); });
});
afterEach(() => vi.useRealTimers());

describe("rush: best score checked by the server", () => {
  it("reports no best before any checked run", async () => {
    expect(await best()).toEqual({ day: DAY, best: null });
  });

  it("scores a solved run by replaying it and sets the day's best", async () => {
    const { id, day } = await start();
    expect(day).toBe(DAY);
    vi.setSystemTime(new Date(`${DAY}T12:02:00Z`));
    const r = await call("/api/rush/finish", { id, moves: solved(5) });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ score: 5, best: 5 });
    expect(await best()).toEqual({ day: DAY, best: 5 });
  });

  it("does not score a forged claim with wrong moves", async () => {
    const { id } = await start();
    const p0: any = rushPuzzle(DAY, 0);
    const moves: unknown[][] = solved(5).map((m) => m.map(() => 0)); // cell 0 / column 0: not the win
    moves[0] = [p0.board.findIndex((v: string, c: number) => v === "" && !p0.answers.includes(c))];
    const r = await call("/api/rush/finish", { id, moves, score: 99 });
    expect(await r.json()).toEqual({ score: 0, best: 0 });
    expect(await best()).toEqual({ day: DAY, best: null });
  });

  it("rejects an id used twice and an id it never issued", async () => {
    const { id } = await start();
    expect((await call("/api/rush/finish", { id, moves: solved(2) })).status).toBe(200);
    expect((await call("/api/rush/finish", { id, moves: solved(9) })).status).toBe(404);
    expect((await call("/api/rush/finish", { id: "nope", moves: [] })).status).toBe(404);
    expect(await best()).toEqual({ day: DAY, best: 2 });
  });

  it("rejects a finish after 190 seconds and keeps the id spent", async () => {
    const { id } = await start();
    vi.setSystemTime(new Date(`${DAY}T12:03:11Z`));
    expect((await call("/api/rush/finish", { id, moves: solved(3) })).status).toBe(410);
    expect(await best()).toEqual({ day: DAY, best: null });
    expect((await call("/api/rush/finish", { id, moves: [] })).status).toBe(404);
  });

  it("keeps the best when a later run scores lower", async () => {
    const a = await start();
    await call("/api/rush/finish", { id: a.id, moves: solved(6) });
    const b = await start();
    const r = await call("/api/rush/finish", { id: b.id, moves: solved(2) });
    expect(await r.json()).toEqual({ score: 2, best: 6 });
  });

  it("rejects an oversized or malformed body", async () => {
    const { id } = await start();
    expect((await call("/api/rush/finish", undefined, JSON.stringify({ id, moves: [], pad: "x".repeat(30000) }))).status).toBe(413);
    expect((await call("/api/rush/finish", undefined, "{not json")).status).toBe(400);
    expect((await call("/api/rush/finish", { id, moves: "x" })).status).toBe(400);
    expect((await call("/api/rush/finish", { id, moves: [["a"]] })).status).toBe(400);
    expect((await call("/api/rush/finish", { id, moves: [Array(100).fill(0)] })).status).toBe(400);
    expect((await call("/api/rush/finish", { id, moves: Array(500).fill([0]) })).status).toBe(400);
    expect((await call("/api/rush/finish", { id, moves: solved(1) })).status).toBe(200); // the id survived the bad bodies
  });

  it("removes stale ids on later calls so storage does not grow", async () => {
    await start();
    await start();
    vi.setSystemTime(new Date(`${DAY}T12:30:00Z`));
    await start();
    const n = await runInDurableObject(lobby(), async (_o, st) => st.storage.sql.exec("SELECT COUNT(*) AS n FROM rush_runs").one().n);
    expect(n).toBe(1);
  });
});

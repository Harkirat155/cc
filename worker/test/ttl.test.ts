import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { open } from "./helpers";
import type { Room } from "../src/room";

// server/roomGC.js: a room goes only when it has no occupants AND now - lastTouched > ROOM_TTL_MS.
const TTL = 120_000;
const rooms = () => (env as unknown as { ROOM: DurableObjectNamespace<Room> }).ROOM;
const stored = (stub: DurableObjectStub<Room>) => runInDurableObject(stub, async (_o, st) => st.storage.get<any>("room"));
const alarmAt = (stub: DurableObjectStub<Room>) => runInDurableObject(stub, async (_o, st) => st.storage.getAlarm());
// Set lastTouched and the occupants straight in the live instance and in storage.
const set = (stub: DurableObjectStub<Room>, patch: (s: any) => void) =>
  runInDurableObject(stub, async (o, st) => { const s = (o as any).s; patch(s); await st.storage.put("room", s); });
const ago = (ms: number) => Date.now() - ms;

async function made() {
  const a = await open("/ws/room/new");
  const { roomId } = await a.call("createRoom", { clientId: "c1" });
  return { a, roomId, stub: rooms().getByName(roomId) };
}
const vacate = (stub: DurableObjectStub<Room>, at: number) => set(stub, (s) => { s.players = { X: null, O: null }; s.spectators = []; s.lastTouched = at; });

describe("room TTL alarm (brick 11)", () => {
  it("(a) deletes an empty room older than the TTL: storage is empty", async () => {
    const { stub } = await made();
    await vacate(stub, ago(TTL + 1000));
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await runInDurableObject(stub, async (_o, st) => [...(await st.storage.list())])).toEqual([]);
    expect(await alarmAt(stub)).toBeNull();
  });

  it("(b) keeps an occupied room however old, and re-arms", async () => {
    const { stub } = await made(); // a is seated X on a live socket
    await set(stub, (s) => { s.lastTouched = ago(TTL * 5); });
    await runDurableObjectAlarm(stub);
    expect((await stored(stub))?.players.X).toBeTruthy();
    expect(await alarmAt(stub)).not.toBeNull();
  });

  it("(b2) a spectator keeps the room", async () => {
    const { stub, roomId } = await made();
    const s2 = await open(`/ws/room/${roomId}`);
    await s2.call("joinRoom", { roomId, clientId: "c2" });
    const s3 = await open(`/ws/room/${roomId}`);
    await s3.call("joinRoom", { roomId, clientId: "c3" }); // third is a spectator
    await set(stub, (s) => { s.players = { X: null, O: null }; s.lastTouched = ago(TTL * 5); });
    await runDurableObjectAlarm(stub);
    expect((await stored(stub))?.spectators.length).toBe(1);
  });

  it("(c) an empty room touched within the TTL survives and re-arms at lastTouched+TTL", async () => {
    const { stub } = await made();
    const at = ago(TTL / 2);
    await vacate(stub, at);
    await runDurableObjectAlarm(stub);
    expect((await stored(stub))?.roomId).toBeTruthy();
    expect(await alarmAt(stub)).toBe(at + TTL);
  });

  it("(d) a frame arms an alarm; a later frame does not move it", async () => {
    const { a, stub } = await made();
    const first = await alarmAt(stub);
    expect(first).not.toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    await a.call("createRoom", {}); // a processed frame, touches again
    expect(await alarmAt(stub)).toBe(first);
    await runInDurableObject(stub, async (_o, st) => { await st.storage.deleteAlarm(); });
    await evictDurableObject(stub, { webSockets: "hibernate" });
    await a.call("createRoom", {});
    expect(await alarmAt(stub)).not.toBeNull(); // re-armed after eviction lost the in-memory flag
  });

  it("(e) after deletion joinRoom answers as for a room that never existed", async () => {
    const { a, roomId, stub } = await made();
    await vacate(stub, ago(TTL + 1000));
    await runDurableObjectAlarm(stub); // a's leftover socket is closed by the deletion
    const never = (await open("/ws/room/ZZZZZZ").catch(() => null));
    const b = await open(`/ws/room/${roomId}`);
    const got = await b.call("joinRoom", { roomId, clientId: "x" });
    expect(got).toEqual({ error: "Room not found" });
    if (never) expect(await never.call("joinRoom", { roomId: "ZZZZZZ", clientId: "x" })).toEqual(got);
    expect(await runInDurableObject(stub, async (_o, st) => [...(await st.storage.list())])).toEqual([]);
  });

  it("(f) ROOM_TTL_MS defaults to 120000 and clamps to 10000..3600000", async () => {
    const base = Date.now();
    const at = async (v: unknown) => {
      const { stub } = await made();
      await runInDurableObject(stub, async (o, st) => {
        (o as any).env = { ...(o as any).env, ROOM_TTL_MS: v };
        await st.storage.deleteAlarm();
        (o as any).s.players = { X: null, O: null };
        (o as any).s.lastTouched = base;
        await (o as any).alarm();
      });
      return ((await alarmAt(stub)) as number) - base;
    };
    // An empty room touched just now is re-armed at lastTouched + TTL, which exposes the parsed TTL.
    expect(await at(undefined)).toBe(120_000);
    expect(await at("nope")).toBe(120_000);
    expect(await at("5")).toBe(10_000);
    expect(await at("999999999")).toBe(3_600_000);
    expect(await at("30000")).toBe(30_000);
  });

  it("an unexpired seat token keeps an empty room even past a short TTL", async () => {
    const { stub } = await made();
    await set(stub, (s) => { s.players = { X: null, O: null }; s.lastTouched = ago(TTL + 1000); s.seatTokens = { t: { seat: "O", exp: Date.now() + 60_000 } }; });
    await runDurableObjectAlarm(stub);
    expect((await stored(stub))?.roomId).toBeTruthy();
  });
});

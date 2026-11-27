import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { Client, open } from "./helpers";
import type { Room } from "../src/room";

const rooms = () => (env as unknown as { ROOM: DurableObjectNamespace<Room> }).ROOM;
// A no-op ack that proves every earlier frame from this socket was processed.
const flush = (c: Client) => c.call("createRoom", {});
const got = (c: Client, t: string, from = 0) => c.frames.slice(from).filter((f) => f.t === t);

// a (X) and b (O) joined, c a spectator, u connected but never joined.
async function setup() {
  const a = await open("/ws/room/new");
  const { roomId } = await a.call("createRoom", { clientId: "c1" });
  const b = await open(`/ws/room/${roomId}`);
  await b.call("joinRoom", { roomId, clientId: "c2" });
  const c = await open(`/ws/room/${roomId}`);
  await c.call("joinRoom", { roomId });
  const u = await open(`/ws/room/${roomId}`);
  const roster = (await b.wait((f) => f.t === "gameUpdate" && !!f.d.roster.O)).d.roster;
  return { a, b, c, u, roomId, sidA: roster.X as string, sidB: roster.O as string };
}

describe("voice events", () => {
  it("join, mute and leave reach the others but not the sender, and each publishes", async () => {
    const { a, b, c, roomId, sidA } = await setup();
    const n = [a, b, c].map((x) => x.frames.length);
    a.send("voice:join", { roomId, muted: 1 });
    await b.wait((f) => f.t === "voice:user-joined", n[1]);
    expect((await c.wait((f) => f.t === "voice:user-joined", n[2])).d).toEqual({ socketId: sidA, muted: true });
    a.send("voice:mute-state", { roomId, muted: false });
    expect((await b.wait((f) => f.t === "voice:mute-state", n[1])).d).toEqual({ socketId: sidA, muted: false });
    a.send("voice:leave", { roomId });
    expect((await b.wait((f) => f.t === "voice:user-left", n[1])).d).toEqual({ socketId: sidA });
    await flush(a);
    expect(a.frames.slice(n[0]).filter((f) => f.t.startsWith("voice:"))).toEqual([]);
    // three publishes: join, mute, leave
    expect(got(b, "gameUpdate", n[1]).length).toBe(3);
  });

  it("signal reaches only the target, with from and roomId", async () => {
    const { a, b, c, roomId, sidA, sidB } = await setup();
    const n = [a, b, c].map((x) => x.frames.length);
    a.send("voice:signal", { roomId, targetId: sidB, data: { sdp: "x" } });
    expect((await b.wait((f) => f.t === "voice:signal", n[1])).d).toEqual({ from: sidA, data: { sdp: "x" }, roomId });
    await flush(c); await flush(a);
    expect(got(c, "voice:signal", n[2])).toEqual([]);
    expect(got(a, "voice:signal", n[0])).toEqual([]);
  });

  it("drops a signal with an unknown, self, missing or oversized target, or from an unjoined sender", async () => {
    const { a, b, u, roomId, sidA, sidB } = await setup();
    const n = b.frames.length;
    const na = a.frames.length;
    a.send("voice:signal", { roomId, targetId: "no-such-sid", data: { x: 1 } });
    a.send("voice:signal", { roomId, targetId: sidA, data: { x: 1 } }); // self
    a.send("voice:signal", { roomId, data: { x: 1 } });
    a.send("voice:signal", { roomId, targetId: sidB });
    a.send("voice:signal", { roomId, targetId: sidB, data: "x".repeat(64 * 1024 + 1) });
    u.send("voice:signal", { roomId, targetId: sidB, data: { x: 1 } });
    await flush(a); await flush(u);
    // a valid one afterwards proves the target socket was reachable all along
    a.send("voice:signal", { roomId, targetId: sidB, data: { ok: 1 } });
    await b.wait((f) => f.t === "voice:signal" && f.d.data.ok === 1, n);
    expect(got(b, "voice:signal", n).length).toBe(1);
    expect(got(a, "voice:signal", na)).toEqual([]);
  });

  it("does not relay to a target that has not joined the room", async () => {
    const { a, u, roomId } = await setup();
    // u's sid is learned from its own join-less voice roster: not available, so read it from the DO
    const sidU = await runInDurableObject(rooms().getByName(roomId), async (_o, state) => {
      const sids = state.getWebSockets().map((w) => w.deserializeAttachment() as { sid: string; joined: boolean }).filter((x) => !x.joined);
      return sids[0].sid;
    });
    const n = u.frames.length;
    a.send("voice:signal", { roomId, targetId: sidU, data: { x: 1 } });
    await flush(a); await flush(u);
    expect(got(u, "voice:signal", n)).toEqual([]);
  });

  it("ignores voice join from an unjoined socket", async () => {
    const { a, u, roomId } = await setup();
    const n = a.frames.length;
    u.send("voice:join", { roomId, muted: false });
    await flush(u); await flush(a);
    expect(got(a, "voice:user-joined", n)).toEqual([]);
    expect(got(a, "gameUpdate", n)).toEqual([]);
  });

  it("puts voiceRoster in the published room state", async () => {
    const { a, b, roomId, sidA, sidB } = await setup();
    a.send("voice:join", { roomId, muted: true });
    b.send("voice:join", { roomId });
    const u = (await a.wait((f) => f.t === "gameUpdate" && Object.keys(f.d.voiceRoster).length === 2)).d;
    expect(u.voiceRoster).toEqual({ [sidA]: { muted: true }, [sidB]: { muted: false } });
  });

  it("close removes the socket from voice and tells the others", async () => {
    const { a, b, roomId, sidA } = await setup();
    a.send("voice:join", { roomId, muted: false });
    await b.wait((f) => f.t === "voice:user-joined");
    const n = b.frames.length;
    a.close();
    expect((await b.wait((f) => f.t === "voice:user-left", n)).d).toEqual({ socketId: sidA });
    expect((await b.wait((f) => f.t === "gameUpdate" && !(sidA in f.d.voiceRoster), n)).d.voiceRoster).toEqual({});
  });

  it("leaveRoom removes the socket from voice and tells the others", async () => {
    const { a, b, roomId, sidA } = await setup();
    a.send("voice:join", { roomId });
    await b.wait((f) => f.t === "voice:user-joined");
    const n = b.frames.length;
    await a.call("leaveRoom", { roomId, clientId: "c1" });
    expect((await b.wait((f) => f.t === "voice:user-left", n)).d).toEqual({ socketId: sidA });
  });

  it("voice state survives a hibernate eviction", async () => {
    const { a, b, roomId, sidA } = await setup();
    a.send("voice:join", { roomId, muted: true });
    await b.wait((f) => f.t === "voice:user-joined");
    await evictDurableObject(rooms().getByName(roomId), { webSockets: "hibernate" });
    const n = b.frames.length;
    b.send("voice:join", { roomId });
    const u = (await b.wait((f) => f.t === "gameUpdate" && Object.keys(f.d.voiceRoster).length === 2, n)).d;
    expect(u.voiceRoster[sidA]).toEqual({ muted: true });
    a.send("voice:leave", { roomId }); // sid and membership both restored
    expect((await b.wait((f) => f.t === "voice:user-left", n)).d).toEqual({ socketId: sidA });
  });

  it("a 40-frame ICE burst from one socket is not rate limited under the default limits", async () => {
    const { a, b, roomId, sidB } = await setup();
    const n = b.frames.length;
    for (let i = 0; i < 40; i++) a.send("voice:signal", { roomId, targetId: sidB, data: { candidate: i } });
    await b.wait((f) => f.t === "voice:signal" && f.d.data.candidate === 39, n);
    await flush(a);
    expect(got(a, "error")).toEqual([]);
  });
});

import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import type { Room } from "../src/room";

type Frame = { t: string; id?: number; d?: any };

class Client {
  frames: Frame[] = [];
  private n = 0;
  private waiters: (() => void)[] = [];
  constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      this.frames.push(JSON.parse(e.data as string));
      this.waiters.splice(0).forEach((w) => w());
    });
  }
  send(t: string, d?: unknown) {
    this.ws.send(JSON.stringify({ t, d }));
  }
  async call(t: string, d?: unknown): Promise<any> {
    const id = ++this.n;
    this.ws.send(JSON.stringify({ t, id, d }));
    return (await this.wait((f) => f.t === "ack" && f.id === id)).d;
  }
  async wait(pred: (f: Frame) => boolean, from = 0): Promise<Frame> {
    for (let i = 0; i < 200; i++) {
      const f = this.frames.slice(from).find(pred);
      if (f) return f;
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 10);
      });
    }
    throw new Error(`no frame; got ${JSON.stringify(this.frames)}`);
  }
  update(from = 0) {
    return this.wait((f) => f.t === "gameUpdate", from).then((f) => f.d);
  }
  close() {
    this.ws.close(1000);
  }
}

const rooms = () => (env as unknown as { ROOM: DurableObjectNamespace<Room> }).ROOM;

async function open(path: string): Promise<Client> {
  const r = await app.fetch(new Request(`http://x${path}`, { headers: { Upgrade: "websocket" } }), env);
  expect(r.status).toBe(101);
  const ws = r.webSocket!;
  ws.accept();
  return new Client(ws);
}

async function newRoom(clientId?: string, displayName?: string) {
  const a = await open("/ws/room/new");
  const ack = await a.call("createRoom", { clientId, displayName });
  return { a, ack };
}

describe("Room create/join/leave", () => {
  it("creates, joins, broadcasts, and updates after leave", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    expect(ack.player).toBe("X");
    expect(ack.roomId).toMatch(/^[A-Z0-9]{5}$/);
    const u1 = await a.update();
    expect(u1.roster).toMatchObject({ XName: "Alice", O: null, spectators: [] });
    expect(u1.roomId).toBe(ack.roomId);

    const b = await open(`/ws/room/${ack.roomId.toLowerCase()}`);
    expect(await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" })).toEqual({ player: "O" });
    const ub = await b.update();
    expect(ub.roster).toMatchObject({ XName: "Alice", OName: "Bob" });
    expect((await a.wait((f) => f.t === "startGame")).d).toBeUndefined();
    const afterJoin = a.frames.length;

    expect(await b.call("leaveRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ ok: true });
    const ua = (await a.wait((f) => f.t === "gameUpdate" && f.d.roster.O === null, afterJoin)).d;
    expect(ua.roster.XName).toBe("Alice");
    expect(await b.call("leaveRoom", { roomId: ack.roomId })).toEqual({ error: "Not in room" });
  });

  it("returns the Socket.IO error acks", async () => {
    const a = await open("/ws/room/ZZZZZ");
    expect(await a.call("joinRoom", { roomId: "bad" })).toEqual({ error: "Invalid room ID" });
    expect(await a.call("joinRoom", { roomId: "ZZZZZ" })).toEqual({ error: "Room not found" });
    expect(await a.call("leaveRoom", { roomId: "ZZZZZ" })).toEqual({ error: "Room not found" });
    expect(await a.call("createRoom", {})).toEqual({ error: "Unable to create room, please try again" });
  });

  it("seats a third socket as spectator and ignores junk frames", async () => {
    const { a, ack } = await newRoom();
    const b = await open(`/ws/room/${ack.roomId}`);
    const c = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId });
    expect(await c.call("joinRoom", { roomId: ack.roomId })).toEqual({ player: "spectator" });
    a.ws.send("not json");
    a.ws.send(JSON.stringify({ t: "nope", id: 9 }));
    a.ws.send(new Uint8Array([1]));
    expect(await a.call("leaveRoom", { roomId: ack.roomId })).toEqual({ ok: true });
  });

  it("refuses a non-upgrade request", async () => {
    const r = await app.fetch(new Request("http://x/ws/room/new"), env);
    expect(r.status).toBe(426);
  });
});

describe("display names", () => {
  it("trims to 20, needs 2 chars, and only seated sockets may rename", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: `  ${"n".repeat(30)}  ` });
    const u = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.XName.startsWith("nnn"), 0)).d;
    expect(u.roster.XName).toBe("n".repeat(20));

    const n = b.frames.length;
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: "x" });
    const c = await open(`/ws/room/${ack.roomId}`);
    await c.call("joinRoom", { roomId: ack.roomId }); // spectator
    c.send("updateDisplayName", { roomId: ack.roomId, displayName: "Spectator" });
    // flush: a later valid rename arrives after the two ignored ones
    b.send("updateDisplayName", { roomId: ack.roomId, displayName: "Bobby" });
    await a.wait((f) => f.t === "gameUpdate" && f.d.roster.OName === "Bobby");
    const names = b.frames.slice(n).filter((f) => f.t === "gameUpdate").map((f) => f.d.roster.XName);
    expect(names.every((x: string) => x === "n".repeat(20))).toBe(true);
  });
});

describe("seat rebind (server/socketHandlers.test.js:36)", () => {
  it("same clientId cannot hold X and O when the first socket is still live", async () => {
    const { ack } = await newRoom("client-1");
    const b = await open(`/ws/room/${ack.roomId}`);
    const joined = await b.call("joinRoom", { roomId: ack.roomId, clientId: "client-1" });
    expect(["X", "spectator"]).toContain(joined.player);
    const u = await b.update();
    expect(u.roster.X).not.toBe(u.roster.O);
    expect(u.roster.O).toBeNull();
  });

  it("a reconnect after the old socket closed takes back the same seat", async () => {
    const { a, ack } = await newRoom("c1");
    const o = await open(`/ws/room/${ack.roomId}`);
    await o.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    a.close();
    await o.wait((f) => f.t === "gameUpdate" && f.d.roster.X === null);
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect(await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ player: "X" });
  });

  it("a clientId that owns O is not also given a vacated X by a second socket", async () => {
    const { a, ack } = await newRoom("c1");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2" });
    await a.call("leaveRoom", { roomId: ack.roomId }); // X is now empty, c2 still owns O on a live socket
    const b2 = await open(`/ws/room/${ack.roomId}`);
    expect(await b2.call("joinRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ player: "spectator" });
    const stored = await runInDurableObject(rooms().getByName(ack.roomId), async (_o, state) => state.storage.get<any>("room"));
    expect(stored.seatByClient.c2).toBe("O");
  });

  it("explicit leave frees the clientId reservation", async () => {
    const { a, ack } = await newRoom("c1");
    await a.call("leaveRoom", { roomId: ack.roomId, clientId: "c1" });
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect((await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).player).toBe("X");
  });
});

describe("persistence", () => {
  it("a leaveRoom that only deletes a clientId reservation is saved across eviction", async () => {
    const { a, ack } = await newRoom("c1");
    const stub = rooms().getByName(ack.roomId);
    a.close();
    for (let i = 0; i < 100; i++) {
      const st = await runInDurableObject(stub, async (_o, state) => state.storage.get<any>("room"));
      if (!st.players.X) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const x = await open(`/ws/room/${ack.roomId}`);
    expect(await x.call("leaveRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ error: "Not in room" });
    await evictDurableObject(stub, { webSockets: "hibernate" });
    const stored = await runInDurableObject(stub, async (_o, state) => state.storage.get<any>("room"));
    expect(stored.seatByClient.c1).toBeUndefined();
  });

  it("keeps seats and names in storage", async () => {
    const { ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" });
    const stored = await runInDurableObject(rooms().getByName(ack.roomId), async (_o, state) => state.storage.get<any>("room"));
    expect(stored).toMatchObject({ created: true, seatByClient: { c1: "X", c2: "O" }, names: { X: "Alice", O: "Bob" } });
    expect(stored.players.X).toBeTruthy();
    expect(stored.players.O).toBeTruthy();
  });

  // evictDurableObject (webSockets: "hibernate") tears the instance down and keeps the sockets open,
  // as workerd does on hibernation. The next frame runs a new constructor over stored state, with
  // sids restored from socket attachments.
  it("survives eviction with live sockets: same seats, same sids, broadcasts still reach both", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    const b = await open(`/ws/room/${ack.roomId}`);
    await b.call("joinRoom", { roomId: ack.roomId, clientId: "c2", displayName: "Bob" });
    const before = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.O)).d.roster;

    await evictDurableObject(rooms().getByName(ack.roomId), { webSockets: "hibernate" });

    const n = b.frames.length;
    a.send("updateDisplayName", { roomId: ack.roomId, displayName: "Alicia" });
    const after = (await b.wait((f) => f.t === "gameUpdate" && f.d.roster.XName === "Alicia", n)).d.roster;
    expect(after).toMatchObject({ X: before.X, O: before.O, OName: "Bob" });
    expect(await b.call("leaveRoom", { roomId: ack.roomId, clientId: "c2" })).toEqual({ ok: true });
  });

  it("rebinds a reconnecting clientId after eviction closed every socket", async () => {
    const { a, ack } = await newRoom("c1", "Alice");
    await evictDurableObject(rooms().getByName(ack.roomId), { webSockets: "close" });
    void a;
    const a2 = await open(`/ws/room/${ack.roomId}`);
    expect(await a2.call("joinRoom", { roomId: ack.roomId, clientId: "c1" })).toEqual({ player: "X" });
    expect((await a2.update()).roster.XName).toBe("Alice");
  });
});

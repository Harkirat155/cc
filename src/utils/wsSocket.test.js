/* global process, require */
import { WsSocket } from "./wsSocket.js";

class FakeWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeWS.instances.push(this);
  }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.closed = true; this.onclose?.({}); }
  open() { this.onopen?.({}); }
  recv(frame) { this.onmessage?.({ data: typeof frame === "string" ? frame : JSON.stringify(frame) }); }
  drop() { this.onclose?.({}); }
}

const make = (opts) => new WsSocket("wss://x/ws", { WebSocketImpl: FakeWS, ...opts });
const last = () => FakeWS.instances[FakeWS.instances.length - 1];

beforeEach(() => { FakeWS.instances = []; jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

test("ack resolves by id, out of order", () => {
  const s = make(); last().open();
  const a = jest.fn(), b = jest.fn();
  s.emit("createRoom", { x: 1 }, a);
  s.emit("joinRoom", { roomId: "ABCDE" }, b);
  const [f1, f2] = last().sent;
  expect(f1).toEqual({ t: "createRoom", id: f1.id, d: { x: 1 } });
  expect(f2.id).not.toBe(f1.id);
  last().recv({ t: "ack", id: f2.id, d: { player: "O" } });
  expect(b).toHaveBeenCalledWith({ player: "O" });
  expect(a).not.toHaveBeenCalled();
  last().recv({ t: "ack", id: f1.id, d: { roomId: "ABCDE" } });
  expect(a).toHaveBeenCalledWith({ roomId: "ABCDE" });
});

test("emit without ack sends no id; callback-as-data form works", () => {
  const s = make(); last().open();
  const cb = jest.fn();
  s.emit("makeMove", { index: 1 });
  s.emit("leaveLobby", cb);
  expect(last().sent[0]).toEqual({ t: "makeMove", d: { index: 1 } });
  expect(last().sent[1]).toEqual({ t: "leaveLobby", id: last().sent[1].id });
});

test("ack times out", () => {
  const s = make({ ackTimeout: 1000 }); last().open();
  const cb = jest.fn();
  s.emit("joinLobby", {}, cb);
  jest.advanceTimersByTime(1000);
  expect(cb).toHaveBeenCalledWith({ error: "timeout" });
  last().recv({ t: "ack", id: last().sent[0].id, d: {} });
  expect(cb).toHaveBeenCalledTimes(1);
});

test("pending acks fail on close", () => {
  const s = make(); last().open();
  const cb = jest.fn();
  s.emit("joinLobby", {}, cb);
  last().drop();
  expect(cb).toHaveBeenCalledWith({ error: "disconnected" });
});

test("reconnects after unexpected close; listeners survive", () => {
  const s = make();
  const onUpdate = jest.fn(), onConnect = jest.fn(), onDisc = jest.fn();
  s.on("gameUpdate", onUpdate); s.on("connect", onConnect); s.on("disconnect", onDisc);
  last().open();
  expect(s.connected).toBe(true);
  last().drop();
  expect(onDisc).toHaveBeenCalledWith("transport close");
  expect(s.connected).toBe(false);
  jest.advanceTimersByTime(1000);
  expect(FakeWS.instances).toHaveLength(2);
  last().open();
  expect(onConnect).toHaveBeenCalledTimes(2);
  last().recv({ t: "gameUpdate", d: { n: 1 } });
  expect(onUpdate).toHaveBeenCalledWith({ n: 1 });
});

test("no reconnect after disconnect()", () => {
  const s = make(); last().open();
  const onDisc = jest.fn();
  s.on("disconnect", onDisc);
  s.disconnect();
  jest.advanceTimersByTime(60000);
  expect(FakeWS.instances).toHaveLength(1);
  expect(onDisc).toHaveBeenCalledWith("io client disconnect");
});

test("unparseable frames are ignored", () => {
  const s = make(); last().open();
  const h = jest.fn(); s.on("gameUpdate", h);
  last().recv("not json{"); last().recv("null"); last().recv({ t: 5 });
  last().recv({ t: "gameUpdate", d: 1 });
  expect(h).toHaveBeenCalledTimes(1);
});

describe("socketManager flag", () => {
  const load = async (url) => {
    jest.resetModules();
    const io = jest.fn(() => ({ on: jest.fn(), io: { on: jest.fn() } }));
    jest.doMock("socket.io-client", () => ({ io }));
    process.env.VITE_SOCKET_SERVER = url;
    const m = require("./socketManager.js");
    return { io, m };
  };
  test("http URL still uses socket.io", async () => {
    const { io, m } = await load("https://api.example.com");
    m.getSocket();
    expect(io).toHaveBeenCalledTimes(1);
  });
  test("wss URL uses the shim", async () => {
    globalThis.WebSocket = FakeWS;
    const { io, m } = await load("wss://api.example.com/ws");
    m.getSocket();
    expect(io).not.toHaveBeenCalled();
    expect(FakeWS.instances[0].url).toBe("wss://api.example.com/ws");
  });
});

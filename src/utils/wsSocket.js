/**
 * WebSocket shim speaking docs/ws-protocol.md, exposing the Socket.IO client subset the app uses:
 * emit/on/off/once, id, connected, connect/disconnect/connect_error, io.on/off/once (reconnect events),
 * connect()/disconnect(). Used only when VITE_SOCKET_SERVER is a ws:// or wss:// URL (ADR 0001, brick 4b).
 * The Worker serves two sockets, /ws/lobby and /ws/room/:code (/new creates a room), so the url is a base and the
 * shim moves its one logical socket between them: joinLobby -> lobby, createRoom -> new, joinRoom or matchFound ->
 * the room. Every Room socket open re-sends joinRoom with the clientId (and the matchFound seat token).
 * `id` is client-generated until the Room DO assigns the real socket id (brick 5).
 */
import { getClientId } from "./clientId.js";

const ACK_TIMEOUT = 10000; // Socket.IO has none; the app sets none, so this only bounds a lost ack.
const MAX_ATTEMPTS = 10;
const DELAY = 1000;
const DELAY_MAX = 5000;

class Emitter {
  constructor() { this.h = new Map(); }
  on(e, fn) { (this.h.get(e) || this.h.set(e, new Set()).get(e)).add(fn); return this; }
  off(e, fn) { this.h.get(e)?.delete(fn); return this; }
  once(e, fn) {
    const w = (...a) => { this.off(e, w); fn(...a); };
    return this.on(e, w);
  }
  emitLocal(e, ...a) {
    [...(this.h.get(e) || [])].forEach((fn) => {
      try { fn(...a); } catch (err) { console.error("[WsSocket] handler error:", err); }
    });
  }
}

export class WsSocket extends Emitter {
  constructor(url, { WebSocketImpl = globalThis.WebSocket, ackTimeout = ACK_TIMEOUT } = {}) {
    super();
    this.url = url.replace(/\/+$/, "");
    this.target = "lobby"; // "lobby" | "new" | room code
    this.room = null; // { id, token? } once a room is known: re-joined on every open of its socket
    this.live = false; // the physical socket is open (connected stays true across a route swap)
    this.outbox = [];
    this.WS = WebSocketImpl;
    this.ackTimeout = ackTimeout;
    this.io = new Emitter(); // mirrors socket.io's Manager events: reconnect_attempt/reconnect/reconnect_failed
    this.id = undefined;
    this.connected = false;
    this.nextId = 1;
    this.pending = new Map();
    this.attempt = 0;
    this.wanted = true;
    this.ws = null;
    this.open();
  }

  open() {
    this.wanted = true;
    const path = this.target === "lobby" ? "/ws/lobby" : `/ws/room/${this.target}`;
    const ws = (this.ws = new this.WS(this.url + path));
    let opened = false;
    ws.onopen = () => {
      opened = true;
      const n = this.attempt;
      this.attempt = 0;
      this.id = this.id || `c-${Math.random().toString(36).slice(2, 10)}`;
      this.live = true;
      if (!this.connected) {
        this.connected = true;
        this.emitLocal("connect");
        if (n > 0) this.io.emitLocal("reconnect", n);
      }
      if (this.room && (n > 0 || this.room.token)) {
        const { id: roomId, token } = this.room;
        ws.send(JSON.stringify({ t: "joinRoom", d: { roomId, clientId: getClientId(), token } }));
      }
      this.outbox.splice(0).forEach((m) => ws.send(m));
    };
    ws.onmessage = (ev) => {
      let f;
      try { f = JSON.parse(ev.data); } catch { return; }
      if (!f || typeof f.t !== "string") return;
      if (f.t === "ack") {
        const p = this.pending.get(f.id);
        if (p) { this.pending.delete(f.id); clearTimeout(p.timer); p.cb(f.d); }
        return;
      }
      this.emitLocal(f.t, f.d);
      if (f.t === "matchFound" && f.d?.roomId) {
        this.room = { id: f.d.roomId, token: f.d.token };
        this.swap(f.d.roomId);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.live = false;
      this.outbox = [];
      const was = this.connected;
      this.connected = false;
      this.failPending("disconnected");
      if (was) this.emitLocal("disconnect", this.wanted ? "transport close" : "io client disconnect");
      else if (this.wanted && !opened) this.emitLocal("connect_error", new Error("websocket error"));
      if (this.wanted) this.retry();
    };
  }

  retry() {
    if (this.attempt >= MAX_ATTEMPTS) return this.io.emitLocal("reconnect_failed");
    const delay = Math.min(DELAY * 2 ** this.attempt, DELAY_MAX);
    this.attempt += 1;
    this.io.emitLocal("reconnect_attempt", this.attempt);
    this.timer = setTimeout(() => this.wanted && !this.ws && this.open(), delay);
  }

  failPending(error) {
    this.pending.forEach((p) => { clearTimeout(p.timer); p.cb({ error }); });
    this.pending.clear();
  }

  // Move to another route: the new socket is assigned before the old one closes, so the old onclose is ignored.
  swap(target) {
    const old = this.ws;
    this.target = target;
    this.live = false;
    clearTimeout(this.timer);
    this.attempt = 0;
    this.open();
    old?.close();
  }

  // emit(event, data?, ack?) — data may be omitted: emit("leaveLobby", cb).
  emit(event, data, ack) {
    if (typeof data === "function") { ack = data; data = undefined; }
    if (event === "joinLobby" && this.target !== "lobby") { this.room = null; this.swap("lobby"); }
    if (event === "createRoom" && this.target !== "new") { this.room = null; this.swap("new"); }
    if (event === "joinRoom") {
      const id = String(data?.roomId ?? "").trim().toUpperCase();
      if (id && id !== this.target) { this.room = { id }; this.swap(id); }
    }
    if (event === "createRoom" && typeof ack === "function") {
      const cb = ack;
      ack = (r) => { if (r?.roomId) { this.target = r.roomId; this.room = { id: r.roomId }; } cb(r); };
    }
    const frame = { t: event };
    if (typeof ack === "function") {
      frame.id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(frame.id);
        ack({ error: "timeout" });
      }, this.ackTimeout);
      this.pending.set(frame.id, { cb: ack, timer });
    }
    if (data !== undefined) frame.d = data;
    if (this.ws && this.connected) (this.live ? this.ws.send(JSON.stringify(frame)) : this.outbox.push(JSON.stringify(frame)));
    return this;
  }

  connect() {
    if (!this.ws && !this.connected) { clearTimeout(this.timer); this.attempt = 0; this.open(); }
    return this;
  }

  disconnect() {
    this.wanted = false;
    clearTimeout(this.timer);
    if (this.ws) this.ws.close();
    return this;
  }
}

export const isWsUrl = (u) => /^wss?:\/\//i.test(u || "");

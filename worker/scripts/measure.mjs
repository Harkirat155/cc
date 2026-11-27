#!/usr/bin/env node
// Brick 12a. Play scripted games against a local `wrangler dev` and count what
// the free-plan Durable Object meter would bill for those calls.
//
// billed = upgrades + http + ceil(inbound / 20)
// `http` is HTTP requests that are not WebSocket upgrades. This script issues
// no such requests, so each handshake is counted once (the socket open).
// Outbound frames are free. ADR 0001: "outgoing messages and protocol pings are free".

import process from "node:process";

const LOBBY_MATCHES = 10;
const OPEN_MS = 8_000;
const FRAME_MS = 4_000;
const QUOTE =
  "Incoming WebSocket messages bill 20:1 (100 messages = 5 requests); outgoing messages and protocol pings are free; opening a socket is one request.";

// X (slot 0) moves first. Each script is a finished legal tic-tac-toe game.
const GAMES = [
  [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]],
  [[0, 0], [1, 1], [0, 2], [1, 4], [0, 3], [1, 5], [0, 7], [1, 6], [0, 8]],
  [[0, 0], [1, 1], [0, 3], [1, 2], [0, 6]],
  [[0, 0], [1, 1], [0, 4], [1, 2], [0, 8]],
  [[0, 0], [1, 3], [0, 2], [1, 4], [0, 6], [1, 5]],
];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function assertScripts() {
  for (const moves of GAMES) {
    const board = Array(9).fill("");
    for (let i = 0; i < moves.length; i++) {
      const [slot, cell] = moves[i];
      if (slot !== i % 2 || board[cell] !== "") throw new Error("illegal script");
      board[cell] = slot === 0 ? "X" : "O";
      const win = LINES.some((line) => line.every((c) => board[c] === board[cell]));
      const full = board.every(Boolean);
      const last = i === moves.length - 1;
      if ((win || full) !== last) throw new Error("script does not end on the result");
    }
  }
}

function parseArgs(argv) {
  let base = "http://127.0.0.1:8787";
  let games = 100;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") base = argv[++i];
    else if (arg === "--games") games = Number(argv[++i]);
    else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  let url;
  try {
    url = new URL(base);
  } catch {
    console.error(`bad --base: ${base}`);
    process.exit(2);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    console.error("--base must be http or https");
    process.exit(2);
  }
  if (!Number.isInteger(games) || games < 1) {
    console.error("--games must be a positive integer");
    process.exit(2);
  }
  const ws = new URL(url);
  ws.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  ws.hash = "";
  ws.search = "";
  return { httpBase: url.toString().replace(/\/$/, ""), wsBase: ws.toString().replace(/\/$/, ""), games };
}

function billedOf(sample) {
  return sample.upgrades + sample.http + Math.ceil(sample.inbound / 20);
}

class Sock {
  constructor(ws) {
    this.ws = ws;
    this.frames = [];
    this.inbound = 0;
    this.closed = false;
    this.waiters = [];
    ws.addEventListener("message", (ev) => {
      const text = typeof ev.data === "string" ? ev.data : String(ev.data);
      try {
        this.frames.push(JSON.parse(text));
      } catch {
        this.frames.push({ t: "non-json" });
      }
      this.wake();
    });
    ws.addEventListener("close", () => {
      this.closed = true;
      this.wake();
    });
  }

  wake() {
    const waiters = this.waiters.splice(0);
    for (const wake of waiters) wake();
  }

  send(t, d, id) {
    const body = { t };
    if (id !== undefined) body.id = id;
    if (d !== undefined) body.d = d;
    this.ws.send(JSON.stringify(body));
    this.inbound += 1;
  }

  async wait(pred, from = 0, ms = FRAME_MS) {
    const deadline = Date.now() + ms;
    for (;;) {
      const hit = this.frames.slice(from).find(pred);
      if (hit) return hit;
      if (Date.now() >= deadline) {
        throw new Error(`timeout; last=${JSON.stringify(this.frames.at(-1))}`);
      }
      const left = Math.max(1, deadline - Date.now());
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, Math.min(20, left));
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`open timeout ${url}`));
    }, OPEN_MS);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(new Sock(ws));
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`websocket error ${url}`));
    });
  });
}

async function untilClosed(sock) {
  if (sock.closed || sock.ws.readyState === 3) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    sock.ws.addEventListener("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function isTerminal(frame) {
  return frame.t === "gameUpdate" && (frame.d?.status === "win" || frame.d?.status === "draw");
}

async function playGame(wsBase, n) {
  const t0 = performance.now();
  let opens = 0;
  const a = await connect(`${wsBase}/ws/room/new`);
  opens = addOpen(opens);
  try {
    const clientA = `g${n}-x`;
    const clientB = `g${n}-o`;
    a.send("createRoom", { clientId: clientA, gameId: "ttt" }, 1);
    const created = await a.wait((f) => f.t === "ack" && f.id === 1);
    const roomId = created.d?.roomId;
    if (!roomId || created.d?.error || created.d?.player !== "X") {
      throw new Error(`createRoom failed: ${JSON.stringify(created.d)}`);
    }
    await a.wait((f) => f.t === "gameUpdate");

    const b = await connect(`${wsBase}/ws/room/${roomId}`);
    opens = addOpen(opens);
    try {
      b.send("joinRoom", { roomId, clientId: clientB }, 1);
      const joined = await b.wait((f) => f.t === "ack" && f.id === 1);
      if (joined.d?.player !== "O") throw new Error(`joinRoom failed: ${JSON.stringify(joined.d)}`);
      await a.wait((f) => f.t === "startGame");
      await b.wait((f) => f.t === "startGame");

      const fromB = b.frames.length;
      a.send("updateDisplayName", { roomId, displayName: "Alex" });
      await b.wait((f) => f.t === "gameUpdate" && f.d?.roster?.XName === "Alex", fromB);

      const fromA = a.frames.length;
      b.send("updateDisplayName", { roomId, displayName: "Blair" });
      await a.wait((f) => f.t === "gameUpdate" && f.d?.roster?.OName === "Blair", fromA);

      const moves = GAMES[n % GAMES.length];
      for (const [slot, cell] of moves) {
        const actor = slot === 0 ? a : b;
        const other = slot === 0 ? b : a;
        const from = other.frames.length;
        actor.send("makeMove", { roomId, index: cell });
        await other.wait(
          (f) => f.t === "gameUpdate" && f.d?.lastMove?.cell === cell && f.d?.lastMoveBy === slot,
          from,
        );
      }

      await a.wait(isTerminal);
      await b.wait(isTerminal);
      const result = [...a.frames].reverse().find(isTerminal);
      if (!result) throw new Error("no win or draw");

      const fromReq = b.frames.length;
      a.send("requestNewGame", { roomId });
      await b.wait((f) => f.t === "gameUpdate" && f.d?.newGameRequester, fromReq);

      const leaveFrom = b.frames.length;
      a.close();
      try {
        await b.wait((f) => f.t === "gameUpdate" && !f.d?.roster?.X, leaveFrom, 1_000);
      } catch {
        /* the leave publish is counted when it arrives */
      }
      b.close();
      await Promise.all([untilClosed(a), untilClosed(b)]);

      if (a.frames.some((f) => f.t === "error") || b.frames.some((f) => f.t === "error")) {
        throw new Error("error frame");
      }
      const sample = sampleOf([a, b], opens, t0);
      sample.result = result.d.status;
      return sample;
    } finally {
      b.close();
    }
  } finally {
    a.close();
  }
}

function addOpen(opens) {
  return opens + 1;
}

function sampleOf(socks, opens, t0) {
  return {
    inbound: socks.reduce((n, s) => n + s.inbound, 0),
    outbound: socks.reduce((n, s) => n + s.frames.length, 0),
    // `http` is the non-upgrade term in billed = upgrades + http + ceil(inbound/20).
    http: 0,
    upgrades: opens,
    httpIncludingUpgrades: opens,
    wallMs: Math.round(performance.now() - t0),
  };
}

async function playLobby(wsBase) {
  const t0 = performance.now();
  let opens = 0;
  const a = await connect(`${wsBase}/ws/lobby`);
  opens = addOpen(opens);
  try {
    const b = await connect(`${wsBase}/ws/lobby`);
    opens = addOpen(opens);
    try {
      a.send("joinLobby", { displayName: "Alex", gameId: "ttt" }, 1);
      b.send("joinLobby", { displayName: "Blair", gameId: "ttt" }, 1);
      const ackA = await a.wait((f) => f.t === "ack" && f.id === 1);
      const ackB = await b.wait((f) => f.t === "ack" && f.id === 1);
      if (!ackA.d?.success || !ackB.d?.success) {
        throw new Error(`joinLobby failed: ${JSON.stringify(ackA.d)} ${JSON.stringify(ackB.d)}`);
      }
      const foundA = await a.wait((f) => f.t === "matchFound");
      const foundB = await b.wait((f) => f.t === "matchFound");
      if (!foundA.d?.roomId || !foundB.d?.roomId || !foundA.d?.token || !foundB.d?.token) {
        throw new Error("matchFound missing room or token");
      }
      // Lobby fans lobbyUpdate out on a 100ms alarm. Wait so that frame is in the count.
      await a.wait((f) => f.t === "lobbyUpdate", 0, 1_000);
      await b.wait((f) => f.t === "lobbyUpdate", 0, 1_000);
      a.close();
      b.close();
      await Promise.all([untilClosed(a), untilClosed(b)]);
      return sampleOf([a, b], opens, t0);
    } finally {
      b.close();
    }
  } finally {
    a.close();
  }
}

function p50(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function summarize(samples) {
  const keys = ["inbound", "outbound", "http", "upgrades", "httpIncludingUpgrades", "wallMs", "billed"];
  const totals = {};
  const per = {};
  for (const key of keys) {
    const values = samples.map((s) => s[key]);
    totals[key] = values.reduce((sum, n) => sum + n, 0);
    per[key] = {
      mean: round3(values.reduce((sum, n) => sum + n, 0) / values.length),
      p50: round3(p50(values)),
      max: Math.max(...values),
    };
  }
  return { n: samples.length, totals, per };
}

async function main() {
  assertScripts();
  const { wsBase, games } = parseArgs(process.argv.slice(2));
  const room = [];
  for (let i = 0; i < games; i++) {
    let sample;
    try {
      sample = await playGame(wsBase, i);
    } catch (err) {
      console.error(`game ${i + 1} failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    sample.billed = billedOf(sample);
    room.push(sample);
    if ((i + 1) % 10 === 0 || i + 1 === games) {
      console.error(`games ${i + 1}/${games}`);
    }
  }
  const lobby = [];
  for (let i = 0; i < LOBBY_MATCHES; i++) {
    let sample;
    try {
      sample = await playLobby(wsBase);
    } catch (err) {
      console.error(`lobby ${i + 1} failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    sample.billed = billedOf(sample);
    lobby.push(sample);
  }
  console.error(`lobby ${LOBBY_MATCHES}/${LOBBY_MATCHES}`);

  const roomStats = summarize(room);
  const lobbyStats = summarize(lobby);
  const perGame = roomStats.per.billed.mean;
  const out = {
    quote: QUOTE,
    billedFormula: "upgrades + http + ceil(inbound/20)",
    roomGames: roomStats,
    lobby: lobbyStats,
    gamesPerDay: round3(100000 / perGame),
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

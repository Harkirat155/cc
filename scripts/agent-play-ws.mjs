#!/usr/bin/env node
// ADR 0001 brick 14. Two agents play one tic-tac-toe game over the plain JSON WebSocket protocol, using only what
// public/agent-manifest.json (manifestVersion 2.0) says: routes, event names, the ack and hello envelope, the flow.
// No Socket.IO. Exit 0 only if both agents see the game end with a winner.
//
//   node scripts/agent-play-ws.mjs --host http://127.0.0.1:8799
//   --manifest <path|url>   default public/agent-manifest.json
//   --host <url>            default: the manifest's protocol.url (the live Worker; pass a local one while testing)

import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL } from 'node:url';

/* global fetch, WebSocket */

const TIMEOUT_MS = 20_000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function loadManifest(src) {
  const text = /^https?:/.test(src) ? await (await fetch(src)).text() : await readFile(src, 'utf8');
  return JSON.parse(text);
}

const manifest = await loadManifest(arg('manifest', new URL('../public/agent-manifest.json', import.meta.url).pathname));
if (manifest.manifestVersion !== '2.0') throw new Error(`expected manifestVersion 2.0, got ${manifest.manifestVersion}`);
const { protocol, events } = manifest;
const names = {
  client: new Set(events.clientToServer.map((e) => e.name)),
  server: new Set(events.serverToClient.map((e) => e.name)),
};
for (const n of ['joinLobby', 'joinRoom', 'makeMove']) if (!names.client.has(n)) throw new Error(`manifest has no client event ${n}`);
for (const n of ['matchFound', 'gameUpdate']) if (!names.server.has(n)) throw new Error(`manifest has no server event ${n}`);
const acked = new Set(events.clientToServer.filter((e) => e.ack).map((e) => e.name));

const wsBase = arg('host', protocol.url).replace(/^http/, 'ws').replace(/\/$/, '');
const roomRoute = (roomId) => protocol.routes.room.replace('{roomId}', roomId);

// One socket speaking the manifest's envelope: {t, id?, d?}; hello first; acks matched by id.
class Conn {
  constructor(path, label) {
    this.label = label;
    this.nextId = 1;
    this.pending = new Map();
    this.on = new Map();
    this.ws = new WebSocket(`${wsBase}${path}`);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('error', () => reject(new Error(`${label}: socket error on ${path}`)));
      this.on.set('hello', (d) => resolve(d.sid));
    });
    this.ws.addEventListener('message', (m) => {
      const f = JSON.parse(String(m.data));
      if (f.t === 'ack') this.pending.get(f.id)?.(f.d), this.pending.delete(f.id);
      else this.on.get(f.t)?.(f.d ?? {});
    });
  }
  send(t, d) {
    const frame = { t, ...(acked.has(t) ? { id: this.nextId++ } : {}), ...(d ? { d } : {}) };
    this.ws.send(JSON.stringify(frame));
    return acked.has(t) ? new Promise((resolve) => this.pending.set(frame.id, resolve)) : undefined;
  }
}

function play(name) {
  const clientId = `agent-${randomUUID()}`;
  return new Promise((resolve, reject) => {
    (async () => {
      const lobby = new Conn(protocol.routes.lobby, name);
      await lobby.ready;
      const found = new Promise((r) => lobby.on.set('matchFound', r));
      const ack = await lobby.send('joinLobby', { displayName: name, gameId: 'ttt' });
      if (!ack.success) throw new Error(`${name}: joinLobby ${JSON.stringify(ack)}`);
      const match = await found;
      lobby.ws.close();

      const room = new Conn(roomRoute(match.roomId), name);
      await room.ready;
      const joined = await room.send('joinRoom', { roomId: match.roomId, clientId, displayName: name, token: match.token });
      if (joined.error) throw new Error(`${name}: joinRoom ${joined.error}`);
      const slot = joined.player === 'X' ? 0 : 1;
      console.log(`${name}: seat ${joined.player} in room ${match.roomId}`);

      let lastMoveAt = -1;
      room.on.set('gameUpdate', (s) => {
        if (s.status !== 'active') {
          room.ws.close();
          return resolve({ name, seat: joined.player, status: s.status, winnerSlot: s.winnerSlot, winningCells: s.winningCells, board: s.board });
        }
        const filled = s.board.filter(Boolean).length;
        if (s.turnSlot !== slot || !s.roster.X || !s.roster.O || filled === lastMoveAt) return;
        lastMoveAt = filled;
        const cell = s.board.findIndex((c) => !c);
        room.send('makeMove', { roomId: s.roomId, move: { type: 'place', cell } });
      });
    })().catch(reject);
  });
}

const timer = setTimeout(() => {
  console.error(`FAIL: no result within ${TIMEOUT_MS} ms`);
  process.exit(1);
}, TIMEOUT_MS);

try {
  const [a, b] = await Promise.all([play('Agent A'), play('Agent B')]);
  clearTimeout(timer);
  for (const r of [a, b]) console.log(`${r.name} saw gameOver: status=${r.status} winnerSlot=${r.winnerSlot} winningCells=${JSON.stringify(r.winningCells)}`);
  const ok = [a, b].every((r) => r.status === 'win' && r.winnerSlot === 0 && r.winningCells.length === 3);
  console.log(ok ? `PASS: X won in ${a.board.filter(Boolean).length} moves over plain WebSocket at ${wsBase}` : 'FAIL: unexpected outcome');
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}

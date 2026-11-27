/**
 * @jest-environment node
 */
// ADR 0001 brick 4a: docs/ws-protocol.md must list exactly the events the server registers and emits.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd(); // jest runs from the repo root
const read = (p) => readFileSync(join(root, p), 'utf8');

const serverSources = [
  'server/app.js',
  'server/lobbyManager.js',
  'server/rateLimiter.js',
  'server/roomPublisher.js',
  ...readdirSync(join(root, 'server/handlers'))
    .filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'validation.js')
    .map((f) => `server/handlers/${f}`),
  ...readdirSync(join(root, 'server/utils'))
    .filter((f) => f.endsWith('.js') && !f.includes('.test.'))
    .map((f) => `server/utils/${f}`),
].map(read);

const names = (re) =>
  [...new Set(serverSources.flatMap((src) => [...src.matchAll(re)].map((m) => m[1])))].sort();

// socket.on('x') registrations; `disconnect` is Socket.IO built-in, not part of the protocol.
const registered = names(/\bsocket\.on\(\s*'([^']+)'/g).filter((n) => n !== 'disconnect');
// .emit('x') calls on io, socket or io.to(...) chains.
const emitted = names(/\.emit\(\s*'([^']+)'/g);

function headings(section) {
  const doc = read('docs/ws-protocol.md');
  const body = doc.split(new RegExp(`^## ${section}.*$`, 'm'))[1].split(/^## /m)[0];
  return [...body.matchAll(/^### `([^`]+)`/gm)].map((m) => m[1]).sort();
}

describe('docs/ws-protocol.md parity with server code', () => {
  test('client to server headings equal the registered events', () => {
    expect(registered).toHaveLength(17);
    expect(headings('Client to server')).toEqual(registered);
  });

  test('server to client headings equal the emitted events', () => {
    expect(emitted).toHaveLength(12);
    expect(headings('Server to client')).toEqual(emitted);
  });
});

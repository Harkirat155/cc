/** @jest-environment node */
// ADR 0001 brick 14: the v2 manifest's events must equal docs/ws-protocol.md. The spec is parsed here, not copied,
// so a spec change the manifest misses fails this test.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAgentManifest } from './agentManifest.js';

const root = process.cwd(); // jest runs from the repo root
const spec = readFileSync(join(root, 'docs/ws-protocol.md'), 'utf8');

// Keys at depth 1 of the object that starts at text[start] === '{'. `"k":` and `"k"?:` are keys; other strings are values.
function topLevelKeys(text, start) {
  const keys = [];
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) break;
    } else if (ch === '"') {
      const end = text.indexOf('"', i + 1);
      const after = text.slice(end + 1).match(/^\??:/);
      if (depth === 1 && after) keys.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return keys;
}

function specEvents() {
  const events = [];
  for (const [heading, direction] of [['Client to server', 'client->server'], ['Server to client', 'server->client']]) {
    const body = spec.split(new RegExp(`^## ${heading}.*$`, 'm'))[1].split(/^## /m)[0];
    for (const section of body.split(/^### /m).slice(1)) {
      const name = section.match(/^`([^`]+)`/)[1];
      const frame = section.match(new RegExp(`\`(\\{"t":"${name}"[^\`]*)\``))?.[1] ?? '';
      let fields = [];
      const d = frame.match(/"d"\??:\{/);
      if (d && !frame.slice(d.index).startsWith('"d":{...}')) fields = topLevelKeys(frame, d.index + d[0].length - 1);
      else if (d) {
        const line = section.split('\n').find((l) => l.includes('full room state:'));
        fields = [...line.split('full room state:')[1].matchAll(/`([^`]+)`/g)].map((m) => m[1].split(':')[0]);
      }
      const ackBody = section.match(/Ack: `(\{[^`]*\})`/)?.[1];
      const ackFields = ackBody ? topLevelKeys(ackBody, 0).sort() : undefined;
      const roster = section.match(/`roster:\{([^}]*)\}`/)?.[1];
      const rosterFields = roster ? roster.split(',').map((k) => k.split(':')[0]).sort() : undefined;
      if (direction === 'server->client' && /Express \(Fly\) host only/.test(section)) continue; // the manifest is the Worker protocol
      events.push({ name, direction, ack: direction === 'client->server' && /"id":n/.test(frame), fields: fields.sort(), ackFields, rosterFields });
    }
  }
  return events;
}

const req = { get: () => undefined, protocol: 'https' };
const normalize = (events, direction) =>
  events.map((e) => ({
    name: e.name, direction, ack: Boolean(e.ack), fields: [...e.payloadFields].sort(),
    ackFields: e.ackFields && [...e.ackFields].sort(), rosterFields: e.rosterFields && [...e.rosterFields].sort(),
  }));
const fromManifest = (m) =>
  [...normalize(m.events.clientToServer, 'client->server'), ...normalize(m.events.serverToClient, 'server->client')];
const byName = (list) => [...list].sort((a, b) => (a.direction + a.name).localeCompare(b.direction + b.name));

describe('agent manifest v2 events equal docs/ws-protocol.md', () => {
  const expected = byName(specEvents());

  test('the spec parser finds the 17 + 11 Worker events with ack bodies and roster subfields', () => {
    expect(expected.filter((e) => e.direction === 'client->server')).toHaveLength(17);
    expect(expected.filter((e) => e.direction === 'server->client')).toHaveLength(11);
    expect(expected.find((e) => e.name === 'server:shutdown')).toBeUndefined(); // Express only
    expect(expected.find((e) => e.name === 'joinRoom')).toEqual({
      name: 'joinRoom', direction: 'client->server', ack: true, fields: ['clientId', 'displayName', 'roomId', 'token'],
      ackFields: ['player'], rosterFields: undefined,
    });
    expect(expected.find((e) => e.name === 'createRoom').ackFields).toEqual(['player', 'roomId']);
    expect(expected.find((e) => e.name === 'gameUpdate').rosterFields).toEqual(['O', 'OName', 'X', 'XName', 'spectators']);
  });

  test('buildAgentManifest publishes manifestVersion 2.0 with exactly those events', () => {
    const manifest = buildAgentManifest(req);
    expect(manifest.manifestVersion).toBe('2.0');
    expect(byName(fromManifest(manifest))).toEqual(expected);
  });

  test('public/agent-manifest.json publishes the same events', () => {
    const file = JSON.parse(readFileSync(join(root, 'public/agent-manifest.json'), 'utf8'));
    expect(file.manifestVersion).toBe('2.0');
    expect(byName(fromManifest(file))).toEqual(expected);
  });

  test('the file and the Express builder agree on the Socket.IO description', () => {
    const file = JSON.parse(readFileSync(join(root, 'public/agent-manifest.json'), 'utf8')).deprecated.socketIo;
    const built = buildAgentManifest(req).deprecated.socketIo;
    for (const k of ['status', 'manifestVersion', 'sunset', 'replacedBy', 'url', 'namespace', 'path', 'transports']) {
      expect({ [k]: built[k] }).toEqual({ [k]: file[k] });
    }
    // eventContract (builder) vs events (file): every contract event is in the file, with the same payload and ack keys.
    const fileEvents = [...file.events.clientToServer, ...file.events.serverToClient];
    for (const [name, c] of Object.entries(built.eventContract)) {
      const f = fileEvents.find((e) => e.name === name && (c.direction === 'client->server') === file.events.clientToServer.includes(e));
      expect(f).toBeDefined();
      if (c.payload && f.payload) expect(Object.keys(f.payload).sort()).toEqual(Object.keys(c.payload).sort());
      if (c.payload && f.payloadFields) expect(f.payloadFields).toEqual(expect.arrayContaining(Object.keys(c.payload))); // the builder shows a sample
      expect(Object.keys(f.ack || {}).sort()).toEqual(Object.keys(c.ack || {}).sort());
    }
  });

  test('both manifests name the same Worker host and list Socket.IO as deprecated with a sunset', () => {
    const file = JSON.parse(readFileSync(join(root, 'public/agent-manifest.json'), 'utf8'));
    const manifest = buildAgentManifest(req);
    expect(file.protocol).toEqual(manifest.protocol);
    for (const m of [file, manifest]) {
      expect(m.deprecated.socketIo.sunset).toMatch(/14 days after the Worker cut-over/);
      expect(m.deprecated.socketIo.url).toBe('https://crisscross-backend.fly.dev');
    }
  });
});

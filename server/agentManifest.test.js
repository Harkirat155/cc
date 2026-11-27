/** @jest-environment node */

import { createServer, request } from 'http';

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function waitForListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: {
          Host: 'agent.example.test',
          'X-Forwarded-Proto': 'https',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(body),
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.once('error', reject);
    req.end();
  });
}

describe('GET /agent/manifest.json', () => {
  let port;
  let server;
  let io;
  let rooms;
  let clearRooms;
  let stopRoomGC;
  let stopRateLimitCleanup;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    port = await getFreePort();
    process.env.PORT = String(port);

    ({ server, io } = await import('./app.js'));
    ({ rooms, clearRooms, stopRoomGC } = await import('./roomManager.js'));
    ({ stopRateLimitCleanup } = await import('./rateLimiter.js'));
    await waitForListening(server);
  });

  afterEach(() => {
    clearRooms();
  });

  afterAll(async () => {
    stopRateLimitCleanup();
    stopRoomGC();
    if (io) await new Promise((resolve) => io.close(resolve));
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  });

  test('returns public agent contract metadata without creating rooms', async () => {
    expect(rooms.size).toBe(0);

    const response = await getJson(port, '/agent/manifest.json');

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(rooms.size).toBe(0);

    expect(response.body).toMatchObject({
      name: 'CrissCross Agent Manifest',
      manifestVersion: '2.0',
      app: {
        name: 'CrissCross',
        packageName: 'crisscross-tictactoe',
        version: '1.0.0',
      },
      protocol: {
        type: 'websocket-json',
        url: 'https://cc-api.harkirat-hira.workers.dev',
        routes: { lobby: '/ws/lobby', room: '/ws/room/{roomId}', newRoom: '/ws/room/new' },
      },
      deprecated: {
        socketIo: {
          status: 'deprecated',
          sunset: expect.stringContaining('14 days after the Worker cut-over'),
          url: 'https://crisscross-backend.fly.dev',
          detectedUrl: 'https://agent.example.test',
          namespace: '/',
          path: '/socket.io',
          transports: ['websocket', 'polling'],
        },
      },
      roomUrlFormat: 'https://harkirat155.github.io/cc/room/{roomId}',
    });

    expect(response.body.supportedGames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ttt',
          displayName: 'Tic-Tac-Toe',
          boardSpec: { kind: 'grid', rows: 3, cols: 3 },
          playerInfo: expect.any(Array),
          moveStyle: 'place',
        }),
        expect.objectContaining({
          id: 'connect4',
          displayName: 'Connect Four',
          boardSpec: { kind: 'grid', rows: 6, cols: 7 },
          playerInfo: expect.any(Array),
          moveStyle: 'place',
        }),
        expect.objectContaining({
          id: 'checkers',
          displayName: 'Checkers',
          boardSpec: { kind: 'grid', rows: 8, cols: 8, dark: true },
          playerInfo: expect.any(Array),
          moveStyle: 'select-target',
        }),
      ])
    );

    expect(Object.keys(response.body.deprecated.socketIo.eventContract)).toEqual(
      expect.arrayContaining([
        'createRoom',
        'joinRoom',
        'gameUpdate',
        'makeMove',
        'resetGame',
        'switchGame',
        'joinLobby',
      ])
    );
    expect(response.body.events.clientToServer.map((e) => e.name)).toContain('makeMove');
    expect(response.body.notes.join(' ')).toContain('rate limits');
    expect(response.body.notes.join(' ')).toContain('non-privileged');
  });
});

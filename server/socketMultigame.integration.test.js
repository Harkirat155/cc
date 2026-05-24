/** @jest-environment node */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as createClient } from 'socket.io-client';
import '../shared/games/index.js';
import { registerSocketHandlers } from './socketHandlers.js';
import { clearRooms, rooms } from './roomManager.js';
import {
  lobbyManager,
  broadcastLobbyStateImmediate,
} from './lobbyManager.js';
import { stopRateLimitCleanup } from './rateLimiter.js';

jest.setTimeout(20_000);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for socket connect')), 5_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForEvent(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for ${event}`));
      },
      5_000
    );

    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event} ack`)), 5_000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

async function closeSocket(socket) {
  if (!socket.connected) {
    socket.close();
    return;
  }

  await new Promise((resolve) => {
    socket.once('disconnect', resolve);
    socket.disconnect();
  });
}

async function createHarness() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 1_000,
    pingTimeout: 5_000,
  });

  registerSocketHandlers(io);
  const port = await listen(httpServer);
  const url = `http://127.0.0.1:${port}`;
  const clients = [];

  async function connectClient() {
    const client = createClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5_000,
    });
    clients.push(client);
    await waitForConnect(client);
    return client;
  }

  async function close() {
    await Promise.allSettled(clients.map(closeSocket));
    await new Promise((resolve) => io.close(resolve));
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  }

  return { connectClient, close };
}

let harness;

beforeEach(() => {
  clearRooms();
  lobbyManager.clearQueue();
});

afterEach(async () => {
  if (harness) {
    await harness.close();
    harness = null;
  }
  broadcastLobbyStateImmediate({ emit: () => {} });
  clearRooms();
  lobbyManager.clearQueue();
  stopRateLimitCleanup();
});

async function startHarness() {
  harness = await createHarness();
  return harness;
}

describe('Socket.IO multigame integration', () => {
  test('matchmaking carries first player game preference and switchGame keeps seats connected', async () => {
    const h = await startHarness();
    const playerX = await h.connectClient();
    const playerO = await h.connectClient();
    const xSocketId = playerX.id;
    const oSocketId = playerO.id;

    const queuedWithGame = waitForEvent(
      playerX,
      'lobbyUpdate',
      (payload) => payload.queue?.some((p) => p.socketId === xSocketId && p.gameId === 'connect4')
    );
    const firstAck = await emitAck(playerX, 'joinLobby', {
      displayName: 'Alpha',
      gameId: 'connect4',
    });
    expect(firstAck).toEqual({ success: true, position: 0 });
    expect(await queuedWithGame).toMatchObject({
      queue: [expect.objectContaining({ socketId: xSocketId, displayName: 'Alpha', gameId: 'connect4' })],
    });

    const xMatch = waitForEvent(playerX, 'matchFound');
    const oMatch = waitForEvent(playerO, 'matchFound');
    const xConnect4 = waitForEvent(
      playerX,
      'gameUpdate',
      (payload) => payload.gameId === 'connect4' && payload.board?.length === 42
    );
    const oConnect4 = waitForEvent(
      playerO,
      'gameUpdate',
      (payload) => payload.gameId === 'connect4' && payload.board?.length === 42
    );

    const secondAck = await emitAck(playerO, 'joinLobby', {
      displayName: 'Beta',
      gameId: 'checkers',
    });
    expect(secondAck).toEqual({ success: true, position: 1 });

    const [matchX, matchO, stateX, stateO] = await Promise.all([
      xMatch,
      oMatch,
      xConnect4,
      oConnect4,
    ]);

    expect(matchX).toMatchObject({ player: 'X', opponent: 'Beta' });
    expect(matchO).toMatchObject({ player: 'O', opponent: 'Alpha' });
    expect(matchX.roomId).toBe(matchO.roomId);
    expect(stateX).toMatchObject({ roomId: matchX.roomId, boardSpec: { rows: 6, cols: 7 } });
    expect(stateO).toMatchObject({ roomId: matchX.roomId, boardSpec: { rows: 6, cols: 7 } });
    expect(lobbyManager.getQueueSize()).toBe(0);

    const roomId = matchX.roomId;
    const room = rooms.get(roomId);
    expect(room.gameId).toBe('connect4');
    expect(room.players).toMatchObject({ X: xSocketId, O: oSocketId });
    expect(playerX.id).toBe(xSocketId);
    expect(playerO.id).toBe(oSocketId);

    const xResetCheckers = waitForEvent(
      playerX,
      'gameReset',
      (payload) => payload.reason === 'gameSwitch' && payload.gameId === 'checkers'
    );
    const oResetCheckers = waitForEvent(
      playerO,
      'gameReset',
      (payload) => payload.reason === 'gameSwitch' && payload.gameId === 'checkers'
    );
    const xCheckers = waitForEvent(
      playerX,
      'gameUpdate',
      (payload) => payload.gameId === 'checkers' && payload.board?.length === 64
    );
    const oCheckers = waitForEvent(
      playerO,
      'gameUpdate',
      (payload) => payload.gameId === 'checkers' && payload.board?.length === 64
    );

    await expect(emitAck(playerO, 'switchGame', { roomId, gameId: 'checkers' })).resolves.toEqual({
      success: true,
      gameId: 'checkers',
    });
    await Promise.all([xResetCheckers, oResetCheckers, xCheckers, oCheckers]);

    expect(room.gameId).toBe('checkers');
    expect(room.state.board).toHaveLength(64);
    expect(room.state.scores).toEqual([0, 0]);
    expect(room.players).toMatchObject({ X: xSocketId, O: oSocketId });
    expect(playerX.id).toBe(xSocketId);
    expect(playerO.id).toBe(oSocketId);

    const xTtt = waitForEvent(
      playerX,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.length === 9
    );
    const oTtt = waitForEvent(
      playerO,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.length === 9
    );
    await expect(emitAck(playerX, 'switchGame', { roomId, gameId: 'ttt' })).resolves.toEqual({
      success: true,
      gameId: 'ttt',
    });
    await Promise.all([xTtt, oTtt]);

    const xMove = waitForEvent(
      playerX,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.[0] === 'X'
    );
    const oMove = waitForEvent(
      playerO,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.[0] === 'X'
    );
    playerX.emit('makeMove', { roomId, index: 0 });
    await Promise.all([xMove, oMove]);

    expect(room.gameId).toBe('ttt');
    expect(room.state.board[0]).toBe('X');
    expect(room.players).toMatchObject({ X: xSocketId, O: oSocketId });
  });

  test('spectators receive switched game updates but cannot initiate switchGame', async () => {
    const h = await startHarness();
    const host = await h.connectClient();
    const guest = await h.connectClient();
    const spectator = await h.connectClient();

    const created = await emitAck(host, 'createRoom', {
      clientId: 'host-client',
      displayName: 'Host',
      gameId: 'ttt',
    });
    expect(created).toMatchObject({ player: 'X' });
    const { roomId } = created;

    const guestJoinedUpdate = waitForEvent(
      guest,
      'gameUpdate',
      (payload) => payload.roomId === roomId && payload.roster?.O === guest.id
    );
    await expect(emitAck(guest, 'joinRoom', {
      roomId,
      clientId: 'guest-client',
      displayName: 'Guest',
    })).resolves.toEqual({ player: 'O' });
    await guestJoinedUpdate;

    const spectatorJoinedUpdate = waitForEvent(
      spectator,
      'gameUpdate',
      (payload) => payload.roomId === roomId && payload.roster?.spectators?.includes(spectator.id)
    );
    await expect(emitAck(spectator, 'joinRoom', {
      roomId,
      clientId: 'spectator-client',
      displayName: 'Spectator',
    })).resolves.toEqual({ player: 'spectator' });
    await spectatorJoinedUpdate;

    const spectatorCheckers = waitForEvent(
      spectator,
      'gameUpdate',
      (payload) => payload.roomId === roomId && payload.gameId === 'checkers'
    );
    const hostCheckers = waitForEvent(
      host,
      'gameUpdate',
      (payload) => payload.roomId === roomId && payload.gameId === 'checkers'
    );
    await expect(emitAck(host, 'switchGame', { roomId, gameId: 'checkers' })).resolves.toEqual({
      success: true,
      gameId: 'checkers',
    });
    await Promise.all([spectatorCheckers, hostCheckers]);

    const room = rooms.get(roomId);
    expect(room.gameId).toBe('checkers');
    expect(room.spectators.has(spectator.id)).toBe(true);

    await expect(emitAck(spectator, 'switchGame', { roomId, gameId: 'connect4' })).resolves.toEqual({
      success: false,
      error: 'Only seated players can switch games',
    });
    expect(room.gameId).toBe('checkers');
    expect(room.state.board).toHaveLength(64);
  });

  test('invalid lobby preference defaults to ttt and switchGame validation does not mutate room', async () => {
    const h = await startHarness();
    const playerX = await h.connectClient();
    const playerO = await h.connectClient();

    await expect(emitAck(playerX, 'joinLobby', {
      displayName: 'Invalid Pref',
      gameId: 'missing-game',
    })).resolves.toEqual({ success: true, position: 0 });

    const xTtt = waitForEvent(
      playerX,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.length === 9
    );
    const oTtt = waitForEvent(
      playerO,
      'gameUpdate',
      (payload) => payload.gameId === 'ttt' && payload.board?.length === 9
    );
    const xMatch = waitForEvent(playerX, 'matchFound');

    await expect(emitAck(playerO, 'joinLobby', {
      displayName: 'Valid Second',
      gameId: 'connect4',
    })).resolves.toEqual({ success: true, position: 1 });

    const [match] = await Promise.all([xMatch, xTtt, oTtt]);
    const room = rooms.get(match.roomId);
    expect(room.gameId).toBe('ttt');
    expect(room.state.board).toHaveLength(9);

    await expect(emitAck(playerX, 'switchGame', {
      roomId: match.roomId,
      gameId: 'not-real',
    })).resolves.toEqual({ success: false, error: 'Invalid game' });
    expect(room.gameId).toBe('ttt');
    expect(room.state.board).toHaveLength(9);

    await expect(emitAck(playerX, 'switchGame', {
      roomId: 'bad',
      gameId: 'checkers',
    })).resolves.toEqual({ success: false, error: 'Invalid room ID' });
    expect(room.gameId).toBe('ttt');
  });
});
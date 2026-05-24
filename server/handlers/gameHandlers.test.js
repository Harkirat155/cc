import '../../shared/games/index.js'; // register built-in games
import { registerGameHandlers } from './gameHandlers.js';
import {
  rooms,
  createRoom,
  publishImmediate,
} from '../roomManager.js';

// ---- minimal socket/io mocks ----

function createIo() {
  const emitted = [];
  const io = {
    to: (roomId) => ({
      emit: (event, payload) => emitted.push({ roomId, event, payload }),
    }),
    __emitted: emitted,
  };
  return io;
}

function createSocket(id) {
  const listeners = new Map();
  return {
    id,
    on: (event, cb) => listeners.set(event, cb),
    __emit: (event, payload, ack) => listeners.get(event)?.(payload, ack),
  };
}

function setupRoom({ x = 'sockX', o = 'sockO', gameId = 'ttt' } = {}) {
  rooms.clear();
  const roomId = 'ROOM1';
  const room = createRoom(roomId, {
    creatorSocketId: x,
    creatorClientId: 'client-x',
    creatorDisplayName: 'PlayerX',
    gameId,
  });
  room.players.O = o;
  return { roomId, room };
}

function attach(socket, io) {
  registerGameHandlers(socket, io);
}

// Drain the publisher's setImmediate batch and inspect what would go over the wire.
function snapshotWire(io, roomId) {
  publishImmediate(io, roomId);
  // publishImmediate emits synchronously via io.to(roomId).emit('gameUpdate', state)
  const last = io.__emitted.filter((e) => e.event === 'gameUpdate' && e.roomId === roomId).pop();
  return last?.payload;
}

// ---- tests ----

describe('gameHandlers — generic makeMove', () => {
  test('X places a mark and the wire payload keeps legacy shape', () => {
    const io = createIo();
    const { roomId } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    sockX.__emit('makeMove', { roomId, index: 4 });

    const wire = snapshotWire(io, roomId);
    expect(wire.board[4]).toBe('X');
    expect(wire.turn).toBe('O');
    expect(wire.winner).toBeNull();
    expect(wire.xScore).toBe(0);
    expect(wire.oScore).toBe(0);
    expect(wire.gameId).toBe('ttt');
    expect(wire.newGameRequester).toBeNull();
  });

  test('out-of-turn move is silently rejected', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockO = createSocket('sockO');
    attach(sockO, io);

    sockO.__emit('makeMove', { roomId, index: 0 });

    expect(room.state.board.every((c) => c === '')).toBe(true);
    expect(room.state.turn).toBe(0);
  });

  test('move by spectator (unseated socket) is rejected', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockStranger = createSocket('stranger');
    attach(sockStranger, io);

    sockStranger.__emit('makeMove', { roomId, index: 0 });

    expect(room.state.board.every((c) => c === '')).toBe(true);
  });

  test('full game where X wins top row reports legacy winner + scores', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    const sockO = createSocket('sockO');
    attach(sockX, io);
    attach(sockO, io);

    sockX.__emit('makeMove', { roomId, index: 0 });
    sockO.__emit('makeMove', { roomId, index: 3 });
    sockX.__emit('makeMove', { roomId, index: 1 });
    sockO.__emit('makeMove', { roomId, index: 4 });
    sockX.__emit('makeMove', { roomId, index: 2 });

    const wire = snapshotWire(io, roomId);
    expect(wire.winner).toBe('X');
    expect(wire.winningLine).toEqual([0, 1, 2]);
    expect(wire.xScore).toBe(1);
    expect(wire.oScore).toBe(0);

    // Internal state stays slot-indexed
    expect(room.state.status).toBe('win');
    expect(room.state.winner).toBe(0);
    expect(room.state.scores).toEqual([1, 0]);
  });

  test('draw is translated to legacy winner: "draw"', () => {
    const io = createIo();
    const { roomId } = setupRoom();
    const sockX = createSocket('sockX');
    const sockO = createSocket('sockO');
    attach(sockX, io);
    attach(sockO, io);

    // X O X / X O O / O X X (a cat's game)
    const moves = [
      [sockX, 0], [sockO, 1], [sockX, 2],
      [sockX, 3], [sockO, 4], [sockO, 5],
      [sockO, 6], [sockX, 7], [sockX, 8],
    ];
    // Recompute properly: alternate starting with X
    const ordered = [
      [sockX, 0], [sockO, 1], [sockX, 2],
      [sockO, 4], [sockX, 3], [sockO, 5],
      [sockX, 7], [sockO, 6], [sockX, 8],
    ];
    void moves;
    for (const [s, i] of ordered) s.__emit('makeMove', { roomId, index: i });

    const wire = snapshotWire(io, roomId);
    expect(wire.winner).toBe('draw');
    expect(wire.xScore).toBe(0);
    expect(wire.oScore).toBe(0);
  });
});

describe('gameHandlers — resetGame', () => {
  test('after X wins, next game starts with O (loser starts)', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    const sockO = createSocket('sockO');
    attach(sockX, io);
    attach(sockO, io);

    // X wins top row
    sockX.__emit('makeMove', { roomId, index: 0 });
    sockO.__emit('makeMove', { roomId, index: 3 });
    sockX.__emit('makeMove', { roomId, index: 1 });
    sockO.__emit('makeMove', { roomId, index: 4 });
    sockX.__emit('makeMove', { roomId, index: 2 });

    expect(room.state.scores).toEqual([1, 0]);

    sockX.__emit('resetGame', { roomId });

    expect(room.state.board.every((c) => c === '')).toBe(true);
    expect(room.state.turn).toBe(1); // O starts
    expect(room.state.scores).toEqual([1, 0]); // scores preserved

    const wire = snapshotWire(io, roomId);
    expect(wire.turn).toBe('O');
    expect(wire.xScore).toBe(1);
    expect(wire.oScore).toBe(0);
  });

  test('clears any pending new-game request', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    sockX.__emit('requestNewGame', { roomId });
    expect(room.newGameRequester).toBe('sockX');

    sockX.__emit('resetGame', { roomId });
    expect(room.newGameRequester).toBeNull();
    expect(room.newGameRequestedAt).toBeNull();
  });
});

describe('gameHandlers — resetScores & new-game request', () => {
  test('resetScores zeroes both slots without touching the board', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    room.state.scores = [3, 5];
    room.state.board[0] = 'X';

    sockX.__emit('resetScores', { roomId });

    expect(room.state.scores).toEqual([0, 0]);
    expect(room.state.board[0]).toBe('X');

    const wire = snapshotWire(io, roomId);
    expect(wire.xScore).toBe(0);
    expect(wire.oScore).toBe(0);
  });

  test('requestNewGame / cancel surface room-level fields in the wire shape', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    sockX.__emit('requestNewGame', { roomId });
    expect(room.newGameRequester).toBe('sockX');
    expect(typeof room.newGameRequestedAt).toBe('number');

    let wire = snapshotWire(io, roomId);
    expect(wire.newGameRequester).toBe('sockX');

    sockX.__emit('cancelNewGameRequest', { roomId });
    expect(room.newGameRequester).toBeNull();
    wire = snapshotWire(io, roomId);
    expect(wire.newGameRequester).toBeNull();
  });
});

describe('gameHandlers — switchGame', () => {
  test('seated player switches game and resets room state', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    room.state.scores = [3, 2];
    room.newGameRequester = 'sockO';
    room.newGameRequestedAt = Date.now();
    room.lastMove = { type: 'place', cell: 0 };
    room.lastEvents = [{ type: 'place' }];
    room.lastMoveBy = 0;

    let ack;
    sockX.__emit('switchGame', { roomId, gameId: 'connect4' }, (response) => { ack = response; });

    expect(ack).toEqual({ success: true, gameId: 'connect4' });
    expect(room.gameId).toBe('connect4');
    expect(room.state.board).toHaveLength(42);
    expect(room.state.scores).toEqual([0, 0]);
    expect(room.newGameRequester).toBeNull();
    expect(room.newGameRequestedAt).toBeNull();
    expect(room.lastMove).toBeNull();
    expect(room.lastEvents).toBeNull();
    expect(room.lastMoveBy).toBeNull();

    expect(io.__emitted).toContainEqual({
      roomId,
      event: 'gameReset',
      payload: { roomId, gameId: 'connect4', reason: 'gameSwitch' },
    });

    const wire = snapshotWire(io, roomId);
    expect(wire.gameId).toBe('connect4');
    expect(wire.boardSpec).toMatchObject({ rows: 6, cols: 7 });
  });

  test('spectator cannot switch games', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const spectator = createSocket('spectator');
    attach(spectator, io);

    let ack;
    spectator.__emit('switchGame', { roomId, gameId: 'checkers' }, (response) => { ack = response; });

    expect(ack).toEqual({ success: false, error: 'Only seated players can switch games' });
    expect(room.gameId).toBe('ttt');
  });

  test('invalid game is rejected without mutating room', () => {
    const io = createIo();
    const { roomId, room } = setupRoom();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    let ack;
    sockX.__emit('switchGame', { roomId, gameId: 'missing-game' }, (response) => { ack = response; });

    expect(ack).toEqual({ success: false, error: 'Invalid game' });
    expect(room.gameId).toBe('ttt');
    expect(room.state.board).toHaveLength(9);
  });

  test('missing room returns ack error', () => {
    const io = createIo();
    rooms.clear();
    const sockX = createSocket('sockX');
    attach(sockX, io);

    let ack;
    sockX.__emit('switchGame', { roomId: 'ABCDE', gameId: 'checkers' }, (response) => { ack = response; });

    expect(ack).toEqual({ success: false, error: 'Room not found' });
  });
});

describe('gameHandlers — validation', () => {
  test('invalid roomId is dropped', () => {
    const io = createIo();
    rooms.clear();
    const sockX = createSocket('sockX');
    attach(sockX, io);
    // Should not throw
    sockX.__emit('makeMove', { roomId: 'bad', index: 0 });
    sockX.__emit('resetGame', { roomId: 'bad' });
    sockX.__emit('resetScores', { roomId: 'bad' });
  });

  test('missing room is dropped', () => {
    const io = createIo();
    rooms.clear();
    const sockX = createSocket('sockX');
    attach(sockX, io);
    sockX.__emit('makeMove', { roomId: 'ABCDE', index: 0 });
  });
});

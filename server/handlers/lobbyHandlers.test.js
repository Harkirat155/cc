import { jest } from '@jest/globals';
import '../../shared/games/index.js';
import { handleMatch } from './lobbyHandlers.js';
import { clearRooms, rooms } from '../roomManager.js';
import { lobbyManager } from '../lobbyManager.js';

function createIo(socketIds) {
  const emitted = [];
  const sockets = new Map(
    socketIds.map((id) => [id, { id, join: jest.fn() }])
  );

  return {
    sockets: { sockets },
    to: (target) => ({
      emit: (event, payload) => emitted.push({ target, event, payload }),
    }),
    __emitted: emitted,
    __sockets: sockets,
  };
}

describe('lobbyHandlers — matchmaking game selection', () => {
  beforeEach(() => {
    clearRooms();
    lobbyManager.clearQueue();
  });

  test('matched room uses the first queued player game id', () => {
    const io = createIo(['socket1', 'socket2']);
    const player1 = { socketId: 'socket1', displayName: 'Player1', gameId: 'connect4' };
    const player2 = { socketId: 'socket2', displayName: 'Player2', gameId: 'checkers' };

    handleMatch(io, [player1, player2]);

    expect(rooms.size).toBe(1);
    const [roomId, room] = [...rooms.entries()][0];
    expect(room.gameId).toBe('connect4');
    expect(room.state.board).toHaveLength(42);
    expect(room.players).toMatchObject({ X: 'socket1', O: 'socket2' });
    expect(io.__sockets.get('socket1').join).toHaveBeenCalledWith(roomId);
    expect(io.__sockets.get('socket2').join).toHaveBeenCalledWith(roomId);
    expect(io.__emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: 'socket1',
        event: 'matchFound',
        payload: expect.objectContaining({ roomId, player: 'X', opponent: 'Player2' }),
      }),
      expect.objectContaining({
        target: 'socket2',
        event: 'matchFound',
        payload: expect.objectContaining({ roomId, player: 'O', opponent: 'Player1' }),
      }),
    ]));
  });
});
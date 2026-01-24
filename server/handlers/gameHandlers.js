// Game-related socket event handlers

import { calcWinner } from '../gameLogic.js';
import {
  rooms,
  touch,
  publish,
  createInitialGameState,
} from '../roomManager.js';
import { incCounter } from '../metrics.js';
import { validateRoomId, validateIndex } from './validation.js';

/**
 * Register game-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerGameHandlers(socket, io) {
  socket.on('makeMove', ({ roomId, index }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId || !validateIndex(index)) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);

    const { state, players } = room;
    const mark = players.X === socket.id ? 'X' : players.O === socket.id ? 'O' : null;

    // Validate move
    if (!mark || state.winner || state.turn !== mark || state.board[index] !== '') {
      return;
    }

    // Apply move
    state.board[index] = mark;

    const result = calcWinner(state.board);
    if (result) {
      state.winner = result.winner;
      state.winningLine = result.line;
      if (result.winner === 'X') state.xScore += 1;
      if (result.winner === 'O') state.oScore += 1;
      incCounter('gamesCompleted');
    } else {
      state.turn = state.turn === 'X' ? 'O' : 'X';
    }

    publish(io, normalizedRoomId);
  });

  socket.on('resetGame', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);

    const { xScore, oScore, board, winner } = room.state;

    // Determine starting player for next game
    let newTurn = 'X';
    if (Array.isArray(board)) {
      const order = board.filter((c) => c !== '');
      if (winner && winner !== 'draw' && order.length >= 1) {
        const lastMark = order[order.length - 1];
        newTurn = lastMark === 'X' ? 'O' : 'X';
      } else if (winner === 'draw' && order.length >= 2) {
        newTurn = order[order.length - 2] || 'X';
      }
    }

    room.state = { ...createInitialGameState(), turn: newTurn, xScore, oScore };

    publish(io, normalizedRoomId);
    io.to(normalizedRoomId).emit('gameReset', { roomId: normalizedRoomId });
  });

  socket.on('resetScores', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.state.xScore = 0;
    room.state.oScore = 0;
    publish(io, normalizedRoomId);
  });

  socket.on('requestNewGame', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.state.newGameRequester = socket.id;
    room.state.newGameRequestedAt = Date.now();
    publish(io, normalizedRoomId);
  });

  socket.on('cancelNewGameRequest', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.state.newGameRequester = null;
    room.state.newGameRequestedAt = null;
    publish(io, normalizedRoomId);
  });
}

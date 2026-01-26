// Game-related socket event handlers

import { calcWinner, getModeConfig, DEFAULT_MODE, initialState } from '../gameLogic.js';
import {
  rooms,
  touch,
  publish,
  createInitialGameState,
} from '../roomManager.js';
import { incCounter } from '../metrics.js';
import { validateRoomId, validateIndex, validateGameMode } from './validation.js';

/**
 * Register game-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerGameHandlers(socket, io) {
  socket.on('makeMove', ({ roomId, index }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    const gameMode = room.gameMode || DEFAULT_MODE;
    const { size } = getModeConfig(gameMode);

    // Validate index for the board size
    if (!validateIndex(index, size * size)) return;

    touch(normalizedRoomId);

    const { state, players } = room;
    const mark = players.X === socket.id ? 'X' : players.O === socket.id ? 'O' : null;

    // Validate move
    if (!mark || state.winner || state.turn !== mark || state.board[index] !== '') {
      return;
    }

    // Apply move
    state.board[index] = mark;

    // Use mode-aware winner calculation
    const result = calcWinner(state.board, gameMode);
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

    const gameMode = room.gameMode || DEFAULT_MODE;
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

    room.state = { ...createInitialGameState(gameMode), turn: newTurn, xScore, oScore };

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

  // ===== Game Mode Change Request Flow =====

  socket.on('requestModeChange', ({ roomId, newMode }, ack) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) {
      return ack?.({ success: false, error: 'Invalid room ID' });
    }

    const room = rooms.get(normalizedRoomId);
    if (!room) {
      return ack?.({ success: false, error: 'Room not found' });
    }

    const validMode = validateGameMode(newMode);
    
    // Check if requesting a different mode
    if (room.gameMode === validMode) {
      return ack?.({ success: false, error: 'Already in this mode' });
    }

    // Check if there's already a pending mode change request
    if (room.modeChangeRequest) {
      return ack?.({ success: false, error: 'Mode change already pending' });
    }

    touch(normalizedRoomId);

    // Store the mode change request
    room.modeChangeRequest = {
      requesterSocketId: socket.id,
      newMode: validMode,
      requestedAt: Date.now(),
    };

    // Notify all players in the room about the mode change request
    io.to(normalizedRoomId).emit('modeChangeRequested', {
      roomId: normalizedRoomId,
      requesterSocketId: socket.id,
      newMode: validMode,
      requestedAt: room.modeChangeRequest.requestedAt,
    });

    ack?.({ success: true, newMode: validMode });
  });

  socket.on('acceptModeChange', ({ roomId }, ack) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) {
      return ack?.({ success: false, error: 'Invalid room ID' });
    }

    const room = rooms.get(normalizedRoomId);
    if (!room) {
      return ack?.({ success: false, error: 'Room not found' });
    }

    if (!room.modeChangeRequest) {
      return ack?.({ success: false, error: 'No pending mode change' });
    }

    // Only the other player (not the requester) can accept
    if (room.modeChangeRequest.requesterSocketId === socket.id) {
      return ack?.({ success: false, error: 'Cannot accept your own request' });
    }

    touch(normalizedRoomId);

    const newMode = room.modeChangeRequest.newMode;
    const { size } = getModeConfig(newMode);

    // Apply the mode change
    room.gameMode = newMode;
    room.boardSize = size;
    room.state = {
      ...initialState(newMode),
      xScore: room.state.xScore,
      oScore: room.state.oScore,
    };
    
    const requesterSocketId = room.modeChangeRequest.requesterSocketId;
    room.modeChangeRequest = null;

    // Notify all players that mode was changed
    io.to(normalizedRoomId).emit('modeChangeAccepted', {
      roomId: normalizedRoomId,
      newMode,
      acceptedBy: socket.id,
    });

    // Publish updated game state
    publish(io, normalizedRoomId);

    ack?.({ success: true, newMode });
  });

  socket.on('rejectModeChange', ({ roomId }, ack) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) {
      return ack?.({ success: false, error: 'Invalid room ID' });
    }

    const room = rooms.get(normalizedRoomId);
    if (!room) {
      return ack?.({ success: false, error: 'Room not found' });
    }

    if (!room.modeChangeRequest) {
      return ack?.({ success: false, error: 'No pending mode change' });
    }

    // Only the other player (not the requester) can reject
    if (room.modeChangeRequest.requesterSocketId === socket.id) {
      return ack?.({ success: false, error: 'Cannot reject your own request' });
    }

    touch(normalizedRoomId);

    const rejectedMode = room.modeChangeRequest.newMode;
    const requesterSocketId = room.modeChangeRequest.requesterSocketId;
    room.modeChangeRequest = null;

    // Notify all players that mode change was rejected
    io.to(normalizedRoomId).emit('modeChangeRejected', {
      roomId: normalizedRoomId,
      rejectedMode,
      rejectedBy: socket.id,
    });

    ack?.({ success: true });
  });

  socket.on('cancelModeChangeRequest', ({ roomId }, ack) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) {
      return ack?.({ success: false, error: 'Invalid room ID' });
    }

    const room = rooms.get(normalizedRoomId);
    if (!room) {
      return ack?.({ success: false, error: 'Room not found' });
    }

    if (!room.modeChangeRequest) {
      return ack?.({ success: false, error: 'No pending mode change' });
    }

    // Only the requester can cancel
    if (room.modeChangeRequest.requesterSocketId !== socket.id) {
      return ack?.({ success: false, error: 'Only requester can cancel' });
    }

    touch(normalizedRoomId);

    room.modeChangeRequest = null;

    // Notify all players that mode change was cancelled
    io.to(normalizedRoomId).emit('modeChangeCancelled', {
      roomId: normalizedRoomId,
      cancelledBy: socket.id,
    });

    ack?.({ success: true });
  });
}

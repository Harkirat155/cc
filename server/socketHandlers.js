// Optimized Socket event handlers with validation and error handling

import { calcWinner, genCode, initialState } from './gameLogic.js';
import {
  rooms,
  socketRooms,
  touch,
  enforceLRU,
  publish,
  trackSocketRoom,
  cleanupSocket,
  createRoom,
  createInitialGameState,
} from './roomManager.js';
import { lobbyManager, broadcastLobbyState } from './lobbyManager.js';
import { socketLog as log } from './logger.js';
import { createRateLimitMiddleware, clearRateLimit, startRateLimitCleanup } from './rateLimiter.js';
import { incCounter } from './metrics.js';
import config from './config.js';

// Input validation helpers
const validateRoomId = (roomId) => {
  if (!roomId || typeof roomId !== 'string') return null;
  const normalized = roomId.trim().toUpperCase();
  if (normalized.length !== 5 || !/^[A-Z0-9]+$/.test(normalized)) return null;
  return normalized;
};

const validateDisplayName = (name) => {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 20);
  return trimmed.length >= 2 ? trimmed : null;
};

const validateIndex = (index) => {
  return Number.isInteger(index) && index >= 0 && index <= 8;
};

/**
 * Register all socket event handlers
 * @param {Server} io - Socket.IO server instance
 */
export function registerSocketHandlers(io) {
  // Apply rate limiting middleware
  io.use(createRateLimitMiddleware());
  startRateLimitCleanup();

  io.on('connection', (socket) => {
    log.debug('Socket connected', { socketId: socket.id });

    // ========== Room Events ==========

    socket.on('createRoom', (payloadOrAck, maybeAck) => {
      let payload = {};
      let ack = maybeAck;
      
      if (typeof payloadOrAck === 'function') {
        ack = payloadOrAck;
      } else if (payloadOrAck && typeof payloadOrAck === 'object') {
        payload = payloadOrAck;
      }

      const clientId = payload.clientId || null;
      const displayName = validateDisplayName(payload.displayName);

      // Generate unique room code
      let roomId = genCode();
      let attempts = 0;
      while (rooms.has(roomId) && attempts < 10) {
        roomId = genCode();
        attempts++;
      }

      if (rooms.has(roomId)) {
        log.error('Failed to generate unique room code');
        return ack?.({ error: 'Unable to create room, please try again' });
      }

      // Create room
      createRoom(roomId, {
        creatorSocketId: socket.id,
        creatorClientId: clientId,
        creatorDisplayName: displayName,
        initialState: initialState(),
      });

      socket.join(roomId);
      trackSocketRoom(socket.id, roomId);

      log.debug('Room created', { roomId, socketId: socket.id, clientId, displayName });

      ack?.({ roomId, player: 'X' });
      publish(io, roomId);
    });

    socket.on('joinRoom', ({ roomId, clientId, displayName }, ack) => {
      const normalizedRoomId = validateRoomId(roomId);
      if (!normalizedRoomId) {
        return ack?.({ error: 'Invalid room ID' });
      }

      const room = rooms.get(normalizedRoomId);
      if (!room) {
        return ack?.({ error: 'Room not found' });
      }

      touch(normalizedRoomId);
      const validDisplayName = validateDisplayName(displayName);

      // Initialize metadata containers if missing
      if (!room.seatByClient) room.seatByClient = {};
      if (!room.matchedPlayers) {
        room.matchedPlayers = { X: { displayName: null }, O: { displayName: null } };
      }

      let role = null;

      // 1) Rebind seat by clientId
      if (!role && clientId && room.seatByClient[clientId]) {
        const seat = room.seatByClient[clientId];
        if ((seat === 'X' || seat === 'O') && 
            (!room.players[seat] || room.players[seat] === socket.id)) {
          room.players[seat] = socket.id;
          if (validDisplayName && room.matchedPlayers[seat]) {
            room.matchedPlayers[seat].displayName = validDisplayName;
          }
          // Ensure not occupying both seats
          const other = seat === 'X' ? 'O' : 'X';
          if (room.players[other] === socket.id) room.players[other] = null;
          role = seat;
          log.debug('Seat rebound', { roomId: normalizedRoomId, seat, socketId: socket.id });
        }
      }

      // 2) Check if socket already has a seat
      if (!role) {
        if (room.players.X === socket.id) {
          role = 'X';
          if (validDisplayName) room.matchedPlayers.X.displayName = validDisplayName;
        } else if (room.players.O === socket.id) {
          role = 'O';
          if (validDisplayName) room.matchedPlayers.O.displayName = validDisplayName;
        }
      }

      // 3) Assign to open seat
      if (!role) {
        if (!room.players.X) {
          room.players.X = socket.id;
          role = 'X';
          if (clientId) room.seatByClient[clientId] = 'X';
          if (validDisplayName) room.matchedPlayers.X = { displayName: validDisplayName };
        } else if (!room.players.O) {
          // Guard: don't double-seat same client
          const mapped = clientId ? room.seatByClient[clientId] : null;
          if (mapped === 'X' || mapped === 'O') {
            room.spectators.add(socket.id);
            role = 'spectator';
          } else {
            room.players.O = socket.id;
            role = 'O';
            if (clientId) room.seatByClient[clientId] = 'O';
            if (validDisplayName) room.matchedPlayers.O = { displayName: validDisplayName };
          }
        } else {
          room.spectators.add(socket.id);
          role = 'spectator';
        }
      }

      // Safety: ensure single socket doesn't occupy both seats
      if (room.players.X === socket.id && room.players.O === socket.id) {
        const prefer = (clientId && room.seatByClient[clientId]) || role || 'X';
        if (prefer === 'X') room.players.O = null;
        else room.players.X = null;
      }

      socket.join(normalizedRoomId);
      trackSocketRoom(socket.id, normalizedRoomId);

      ack?.({ player: role });

      if (room.players.X && room.players.O) {
        io.to(normalizedRoomId).emit('startGame');
      }

      publish(io, normalizedRoomId);
    });

    socket.on('updateDisplayName', ({ roomId, displayName }) => {
      const normalizedRoomId = validateRoomId(roomId);
      const validName = validateDisplayName(displayName);
      if (!normalizedRoomId || !validName) return;

      const room = rooms.get(normalizedRoomId);
      if (!room) return;

      if (!room.matchedPlayers) {
        room.matchedPlayers = { X: { displayName: null }, O: { displayName: null } };
      }

      let seat = null;
      if (room.players.X === socket.id) seat = 'X';
      else if (room.players.O === socket.id) seat = 'O';

      if (seat) {
        room.matchedPlayers[seat] = { displayName: validName };
        publish(io, normalizedRoomId);
      }
    });

    // ========== Game Events ==========

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
        const order = board.filter(c => c !== '');
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

    socket.on('leaveRoom', ({ roomId, clientId }, ack) => {
      const normalizedRoomId = validateRoomId(roomId);
      if (!normalizedRoomId) return ack?.({ error: 'Invalid room ID' });

      const room = rooms.get(normalizedRoomId);
      if (!room) return ack?.({ error: 'Room not found' });

      let changed = false;

      if (room.players.X === socket.id) {
        room.players.X = null;
        changed = true;
      }
      if (room.players.O === socket.id) {
        room.players.O = null;
        changed = true;
      }
      if (room.spectators?.delete(socket.id)) changed = true;
      if (room.voice?.[socket.id]) {
        delete room.voice[socket.id];
        changed = true;
      }

      // Free seat reservation on explicit leave
      if (clientId && room.seatByClient?.[clientId]) {
        delete room.seatByClient[clientId];
      }

      if (changed) {
        touch(normalizedRoomId);
        socket.leave(normalizedRoomId);

        const set = socketRooms.get(socket.id);
        if (set) {
          set.delete(normalizedRoomId);
          if (set.size === 0) socketRooms.delete(socket.id);
        }

        publish(io, normalizedRoomId);
        return ack?.({ ok: true });
      }

      ack?.({ error: 'Not in room' });
    });

    // ========== Voice Events ==========

    socket.on('voice:join', ({ roomId, muted }) => {
      const normalizedRoomId = validateRoomId(roomId);
      if (!normalizedRoomId) return;

      const room = rooms.get(normalizedRoomId);
      if (!room) return;

      touch(normalizedRoomId);
      if (!room.voice) room.voice = {};
      room.voice[socket.id] = { muted: Boolean(muted) };

      socket.to(normalizedRoomId).emit('voice:user-joined', {
        socketId: socket.id,
        muted: Boolean(muted),
      });
      publish(io, normalizedRoomId);
    });

    socket.on('voice:leave', ({ roomId }) => {
      const normalizedRoomId = validateRoomId(roomId);
      if (!normalizedRoomId) return;

      const room = rooms.get(normalizedRoomId);
      if (!room?.voice) return;

      touch(normalizedRoomId);
      delete room.voice[socket.id];

      socket.to(normalizedRoomId).emit('voice:user-left', { socketId: socket.id });
      publish(io, normalizedRoomId);
    });

    socket.on('voice:mute-state', ({ roomId, muted }) => {
      const normalizedRoomId = validateRoomId(roomId);
      if (!normalizedRoomId) return;

      const room = rooms.get(normalizedRoomId);
      if (!room) return;

      touch(normalizedRoomId);
      if (!room.voice) room.voice = {};
      room.voice[socket.id] = { muted: Boolean(muted) };

      socket.to(normalizedRoomId).emit('voice:mute-state', {
        socketId: socket.id,
        muted: Boolean(muted),
      });
      publish(io, normalizedRoomId);
    });

    socket.on('voice:signal', ({ roomId, targetId, data }) => {
      if (!validateRoomId(roomId) || !targetId || !data) return;

      socket.to(targetId).emit('voice:signal', {
        from: socket.id,
        data,
        roomId,
      });
    });

    // ========== Lobby Events ==========

    socket.on('joinLobby', ({ displayName }, ack) => {
      const result = lobbyManager.addPlayer(socket.id, displayName);

      if (!result.success) {
        return ack?.({ success: false, error: result.error });
      }

      broadcastLobbyState(io);
      ack?.({ success: true, position: result.position });

      // Attempt matching
      const matchResult = lobbyManager.matchPlayers();
      if (matchResult.matched) {
        handleMatch(io, matchResult.players);
      }
    });

    socket.on('leaveLobby', (ack) => {
      const removed = lobbyManager.removePlayer(socket.id);

      if (removed) {
        broadcastLobbyState(io);
        ack?.({ success: true });
      } else {
        ack?.({ success: false, error: 'Not in lobby' });
      }
    });

    socket.on('getLobbyState', (ack) => {
      const state = lobbyManager.getQueueState();
      ack?.({ queue: state });
    });

    // ========== Disconnect ==========

    socket.on('disconnect', (reason) => {
      log.debug('Socket disconnected', { socketId: socket.id, reason });

      // Remove from lobby
      if (lobbyManager.removePlayer(socket.id)) {
        broadcastLobbyState(io);
      }

      // Clean up from all rooms
      const affectedRooms = cleanupSocket(socket.id);
      for (const roomId of affectedRooms) {
        publish(io, roomId);
      }

      // Clear rate limit tracking
      clearRateLimit(socket.id);
    });
  });
}

/**
 * Handle a successful match between two players
 */
function handleMatch(io, players) {
  const [player1, player2] = players;

  // Generate room code
  let roomId = genCode();
  while (rooms.has(roomId)) roomId = genCode();

  // Create room with both players
  rooms.set(roomId, {
    players: { X: player1.socketId, O: player2.socketId },
    spectators: new Set(),
    state: initialState(),
    voice: {},
    seatByClient: {},
    lastTouched: Date.now(),
    matchedPlayers: {
      X: { displayName: player1.displayName },
      O: { displayName: player2.displayName },
    },
  });

  // Add sockets to room
  const socket1 = io.sockets.sockets.get(player1.socketId);
  const socket2 = io.sockets.sockets.get(player2.socketId);

  if (socket1) {
    socket1.join(roomId);
    trackSocketRoom(player1.socketId, roomId);
  }

  if (socket2) {
    socket2.join(roomId);
    trackSocketRoom(player2.socketId, roomId);
  }

  enforceLRU();

  // Notify players
  io.to(player1.socketId).emit('matchFound', {
    roomId,
    player: 'X',
    opponent: player2.displayName,
  });
  io.to(player2.socketId).emit('matchFound', {
    roomId,
    player: 'O',
    opponent: player1.displayName,
  });

  log.info('Match created', {
    roomId,
    player1: player1.displayName,
    player2: player2.displayName,
  });

  broadcastLobbyState(io);
}

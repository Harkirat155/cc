// Lobby-related socket event handlers

import { genCode } from '../gameLogic.js';
import {
  rooms,
  publish,
  trackSocketRoom,
  createRoom,
} from '../roomManager.js';
import { lobbyManager, broadcastLobbyState } from '../lobbyManager.js';
import { socketLog as log } from '../logger.js';

/**
 * Register lobby-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerLobbyHandlers(socket, io) {
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
}

/**
 * Handle a successful match between two players
 * Uses createRoom() helper to ensure metrics are tracked
 * @param {Server} io - Socket.IO server instance
 * @param {Array} players - Array of matched players
 */
export function handleMatch(io, players) {
  const [player1, player2] = players;

  // Generate unique room code
  let roomId = genCode();
  let attempts = 0;
  while (rooms.has(roomId) && attempts < 10) {
    roomId = genCode();
    attempts++;
  }

  // Create room using shared helper (handles metrics + LRU enforcement)
  createRoom(roomId, {
    creatorSocketId: player1.socketId,
    creatorDisplayName: player1.displayName,
  });

  // Get room and add second player
  const room = rooms.get(roomId);
  room.players.O = player2.socketId;
  room.matchedPlayers.O = { displayName: player2.displayName };

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

  // Publish initial game state after sockets have joined
  publish(io, roomId);
}

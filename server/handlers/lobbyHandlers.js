// Lobby-related socket event handlers
// Follows Single Responsibility Principle - each function has one clear purpose

import {
  publish,
  trackSocketRoom,
  createRoom,
  rooms,
} from '../roomManager.js';
import { lobbyManager, broadcastLobbyState } from '../lobbyManager.js';
import { socketLog as log } from '../logger.js';
import { generateUniqueRoomId } from '../utils/roomIdGenerator.js';
import { notifyPlayersOfMatch, notifyPlayersOfMatchFailure } from '../utils/matchNotifier.js';
import { validateGameMode } from './validation.js';

/**
 * Register lobby-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerLobbyHandlers(socket, io) {
  socket.on('joinLobby', ({ displayName, gameMode }, ack) => {
    const validGameMode = validateGameMode(gameMode);
    const result = lobbyManager.addPlayer(socket.id, displayName, validGameMode);

    if (!result.success) {
      return ack?.({ success: false, error: result.error });
    }

    broadcastLobbyState(io, validGameMode);
    ack?.({ success: true, position: result.position, gameMode: validGameMode });

    // Attempt matching for this game mode
    const matchResult = lobbyManager.matchPlayers(validGameMode);
    if (matchResult.matched) {
      handleMatch(io, matchResult.players, matchResult.gameMode);
    }
  });

  socket.on('leaveLobby', (ack) => {
    const playerInfo = lobbyManager.getPlayer(socket.id);
    const gameMode = playerInfo?.gameMode || 'classic';
    const removed = lobbyManager.removePlayer(socket.id);

    if (removed) {
      broadcastLobbyState(io, gameMode);
      ack?.({ success: true });
    } else {
      ack?.({ success: false, error: 'Not in lobby' });
    }
  });

  socket.on('getLobbyState', ({ gameMode } = {}, ack) => {
    const validGameMode = validateGameMode(gameMode);
    const state = lobbyManager.getQueueState(validGameMode);
    ack?.({ queue: state, gameMode: validGameMode });
  });
}

/**
 * Setup room for matched players
 * Single Responsibility: Configure room with both players
 * @param {string} roomId - Room ID
 * @param {Object} player1 - First player details
 * @param {Object} player2 - Second player details
 * @param {string} gameMode - Game mode
 */
function setupMatchedRoom(roomId, player1, player2, gameMode = 'classic') {
  // Create room with first player and game mode
  createRoom(roomId, {
    creatorSocketId: player1.socketId,
    creatorDisplayName: player1.displayName,
    gameMode,
  });

  // Add second player to room
  const room = rooms.get(roomId);
  room.players.O = player2.socketId;
  room.matchedPlayers.O = { displayName: player2.displayName };
}

/**
 * Add players to Socket.IO room
 * Single Responsibility: Join socket connections to room
 * @param {Server} io - Socket.IO server instance
 * @param {string} roomId - Room ID
 * @param {Array} players - Array of player objects
 */
function addPlayersToSocketRoom(io, roomId, players) {
  players.forEach(player => {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.join(roomId);
      trackSocketRoom(player.socketId, roomId);
    }
  });
}

/**
 * Handle a successful match between two players
 * Follows Single Responsibility - orchestrates match creation by delegating to specialized functions
 * @param {Server} io - Socket.IO server instance
 * @param {Array} players - Array of matched players
 * @param {string} gameMode - Game mode for the match
 */
export function handleMatch(io, players, gameMode = 'classic') {
  const [player1, player2] = players;

  // Generate unique room ID
  const roomIdResult = generateUniqueRoomId();
  
  if (!roomIdResult.success) {
    log.error('[Lobby]', roomIdResult.error);
    notifyPlayersOfMatchFailure(io, players, 'Failed to create room');
    return;
  }

  const roomId = roomIdResult.roomId;

  // Setup room and add players with game mode
  setupMatchedRoom(roomId, player1, player2, gameMode);
  addPlayersToSocketRoom(io, roomId, [player1, player2]);

  // Notify players of successful match (include game mode)
  notifyPlayersOfMatch(io, roomId, player1, player2, gameMode);

  // Log match creation
  log.info('Match created', {
    roomId,
    player1: player1.displayName,
    player2: player2.displayName,
    gameMode,
  });

  broadcastLobbyState(io);

  // Publish initial game state after sockets have joined
  publish(io, roomId);
}

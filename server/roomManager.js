// Room Manager - Core room state and socket tracking
// Uses Map for O(1) operations and proper LRU eviction

import config from './config.js';
import { roomLog as log } from './logger.js';
import { incCounter } from './metrics.js';
import { clearPendingPublish } from './roomPublisher.js';
import { get as getGameRules, has as hasGame } from '../shared/games/registry.js';

// Re-export from extracted modules for backward compatibility
export { publish, publishImmediate, clearPendingPublish } from './roomPublisher.js';
export { startRoomGC, stopRoomGC } from './roomGC.js';

export const DEFAULT_GAME_ID = 'ttt';

// Room storage: roomId -> RoomData
// Using Map maintains insertion order for LRU
export const rooms = new Map();

// Socket to rooms mapping: socketId -> Set<roomId>
export const socketRooms = new Map();

/**
 * Update last activity timestamp and maintain LRU order
 * @param {string} id - Room ID
 */
export function touch(id) {
  const room = rooms.get(id);
  if (!room) return;

  // Update timestamp
  room.lastTouched = Date.now();

  // Move to end for LRU ordering (delete and re-set)
  rooms.delete(id);
  rooms.set(id, room);
}

/**
 * Enforce room limit using LRU eviction
 * Removes oldest rooms when over limit
 */
export function enforceLRU() {
  while (rooms.size > config.roomLimit) {
    const oldest = rooms.keys().next().value;
    if (oldest) {
      log.debug('LRU eviction', { roomId: oldest });
      rooms.delete(oldest);
    }
  }
}

/**
 * Create initial game state for a given game id.
 * The state shape is whatever the rules module returns — DO NOT shape-check
 * here. Game-agnostic room-level fields (newGameRequester, etc.) live on the
 * room object, not inside state.
 *
 * @param {string} [gameId='ttt']
 */
export function createInitialGameState(gameId = DEFAULT_GAME_ID) {
  const rules = getGameRules(gameId);
  return rules.createInitialState();
}

/**
 * Create a new room with initial state
 * @param {string} roomId
 * @param {Object} options
 * @returns {Object} Created room
 */
export function createRoom(roomId, options = {}) {
  const {
    creatorSocketId,
    creatorClientId,
    creatorDisplayName,
    initialState,
    gameId,
  } = options;

  const resolvedGameId = gameId && hasGame(gameId) ? gameId : DEFAULT_GAME_ID;

  const room = {
    gameId: resolvedGameId,
    players: { X: creatorSocketId || null, O: null },
    spectators: new Set(),
    state: initialState || createInitialGameState(resolvedGameId),
    voice: {},
    seatByClient: creatorClientId ? { [creatorClientId]: 'X' } : {},
    lastTouched: Date.now(),
    matchedPlayers: {
      X: { displayName: creatorDisplayName || null },
      O: { displayName: null },
    },
    // Room-level (not game-state) — request a fresh game / cancellation.
    newGameRequester: null,
    newGameRequestedAt: null,
  };

  rooms.set(roomId, room);
  enforceLRU();
  incCounter('roomsCreated');

  log.debug('Room created', { roomId, gameId: resolvedGameId, creator: creatorSocketId });

  return room;
}

/**
 * Add a socket to room tracking
 * @param {string} socketId 
 * @param {string} roomId 
 */
export function trackSocketRoom(socketId, roomId) {
  let set = socketRooms.get(socketId);
  if (!set) {
    set = new Set();
    socketRooms.set(socketId, set);
  }
  set.add(roomId);
}

/**
 * Remove a socket from room tracking
 * @param {string} socketId 
 * @param {string} roomId 
 */
export function untrackSocketRoom(socketId, roomId) {
  const set = socketRooms.get(socketId);
  if (set) {
    set.delete(roomId);
    if (set.size === 0) {
      socketRooms.delete(socketId);
    }
  }
}

/**
 * Clean up a socket from all rooms
 * @param {string} socketId 
 * @returns {Set<string>} Affected room IDs
 */
export function cleanupSocket(socketId) {
  const affectedRooms = new Set();
  const roomSet = socketRooms.get(socketId);
  
  if (!roomSet) return affectedRooms;

  for (const roomId of roomSet) {
    const room = rooms.get(roomId);
    if (!room) continue;

    let changed = false;
    
    if (room.players.X === socketId) {
      room.players.X = null;
      changed = true;
    }
    if (room.players.O === socketId) {
      room.players.O = null;
      changed = true;
    }
    if (room.spectators?.delete(socketId)) {
      changed = true;
    }
    if (room.voice?.[socketId]) {
      delete room.voice[socketId];
      changed = true;
    }

    if (changed) {
      touch(roomId);
      affectedRooms.add(roomId);
    }
  }

  socketRooms.delete(socketId);
  return affectedRooms;
}

/**
 * Clear all rooms (for testing)
 */
export function clearRooms() {
  rooms.clear();
  socketRooms.clear();
  clearPendingPublish();
}

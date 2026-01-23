// Optimized Room Manager with efficient data structures and cleanup
// Uses Map for O(1) operations, proper LRU eviction, and batched broadcasts

import config from './config.js';
import { roomLog as log } from './logger.js';
import { incCounter } from './metrics.js';

// Room storage: roomId -> RoomData
// Using Map maintains insertion order for LRU
export const rooms = new Map();

// Socket to rooms mapping: socketId -> Set<roomId>
export const socketRooms = new Map();

// Pending updates for batching: roomId -> timestamp
const pendingPublish = new Map();
let publishScheduled = false;

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
 * Get display name for a player seat
 * @param {Object} room - Room data
 * @param {'X' | 'O'} seat - Player seat
 * @returns {string | null}
 */
function getDisplayName(room, seat) {
  const socketId = room.players[seat];
  if (!socketId) return null;
  
  // Prefer matched player display name
  if (room.matchedPlayers?.[seat]?.displayName) {
    return room.matchedPlayers[seat].displayName;
  }
  
  // Fallback: truncated socket ID
  return socketId.length > 8 ? `${socketId.slice(0, 5)}…` : socketId;
}

/**
 * Build game state payload for broadcasting
 * @param {string} roomId 
 * @param {Object} room 
 * @returns {Object}
 */
function buildGameState(roomId, room) {
  const roster = {
    X: room.players.X,
    O: room.players.O,
    XName: getDisplayName(room, 'X'),
    OName: getDisplayName(room, 'O'),
    spectators: room.spectators ? Array.from(room.spectators) : [],
  };

  // Build voice roster
  const voiceRoster = {};
  if (room.voice) {
    for (const [sid, v] of Object.entries(room.voice)) {
      voiceRoster[sid] = { muted: Boolean(v?.muted) };
    }
  }

  return {
    ...room.state,
    roomId,
    roster,
    voiceRoster,
  };
}

/**
 * Schedule a batched publish for a room
 * Batches multiple updates within the same tick
 * @param {Server} io - Socket.IO server
 * @param {string} roomId 
 */
export function publish(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  pendingPublish.set(roomId, Date.now());
  
  if (!publishScheduled) {
    publishScheduled = true;
    // Use setImmediate for next tick batching (with setTimeout fallback for non-Node environments)
    const scheduleFlush = typeof setImmediate === 'function' ? setImmediate : (fn) => setTimeout(fn, 0);
    scheduleFlush(() => flushPublish(io));
  }
}

/**
 * Flush all pending publishes
 * @param {Server} io 
 */
function flushPublish(io) {
  publishScheduled = false;
  
  for (const [roomId] of pendingPublish) {
    const room = rooms.get(roomId);
    if (room) {
      const state = buildGameState(roomId, room);
      io.to(roomId).emit('gameUpdate', state);
    }
  }
  
  pendingPublish.clear();
}

/**
 * Publish immediately without batching (for critical updates)
 * @param {Server} io 
 * @param {string} roomId 
 */
export function publishImmediate(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const state = buildGameState(roomId, room);
  io.to(roomId).emit('gameUpdate', state);
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
  } = options;

  const room = {
    players: { X: creatorSocketId || null, O: null },
    spectators: new Set(),
    state: initialState || createInitialGameState(),
    voice: {},
    seatByClient: creatorClientId ? { [creatorClientId]: 'X' } : {},
    lastTouched: Date.now(),
    matchedPlayers: {
      X: { displayName: creatorDisplayName || null },
      O: { displayName: null },
    },
  };

  rooms.set(roomId, room);
  enforceLRU();
  incCounter('roomsCreated');
  
  log.debug('Room created', { roomId, creator: creatorSocketId });
  
  return room;
}

/**
 * Create initial game state
 */
export function createInitialGameState() {
  return {
    board: Array(9).fill(''),
    turn: 'X',
    winner: null,
    winningLine: [],
    xScore: 0,
    oScore: 0,
    newGameRequester: null,
    newGameRequestedAt: null,
  };
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

// GC interval reference for cleanup
let gcInterval = null;

/**
 * Start the room garbage collector
 * Removes empty rooms after TTL expires
 */
export function startRoomGC() {
  if (gcInterval) return;

  gcInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [roomId, room] of rooms.entries()) {
      const hasOccupants = !!(
        room.players?.X || 
        room.players?.O || 
        (room.spectators && room.spectators.size > 0)
      );
      
      if (hasOccupants) continue;
      
      const lastActivity = room.lastTouched || 0;
      if (now - lastActivity > config.roomTtlMs) {
        rooms.delete(roomId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.debug('GC cleaned rooms', { cleaned, remaining: rooms.size });
    }
  }, config.roomGcIntervalMs);

  // Don't prevent process exit
  gcInterval.unref?.();
  
  log.info('Room GC started', { 
    intervalMs: config.roomGcIntervalMs, 
    ttlMs: config.roomTtlMs 
  });
}

/**
 * Stop the room garbage collector
 */
export function stopRoomGC() {
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
    log.info('Room GC stopped');
  }
}

/**
 * Clear all rooms (for testing)
 */
export function clearRooms() {
  rooms.clear();
  socketRooms.clear();
  pendingPublish.clear();
}

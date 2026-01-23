// Room state publishing with batched broadcasts
// Batches multiple updates within the same tick for efficiency

import { rooms } from './roomManager.js';

// Pending updates for batching: roomId -> timestamp
const pendingPublish = new Map();
let publishScheduled = false;

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
 * Clear pending publishes (for testing)
 */
export function clearPendingPublish() {
  pendingPublish.clear();
  publishScheduled = false;
}

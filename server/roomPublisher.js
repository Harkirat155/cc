// Room state publishing with batched broadcasts
// Batches multiple updates within the same tick for efficiency

import { rooms } from './roomManager.js';
import { get as getGameRules } from '../shared/games/registry.js';
import { SLOT_TO_MARK } from '../shared/games/ttt.js';

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
 * Translate the internal slot-indexed game state into the legacy wire shape
 * for TTT-aware clients (turn 'X'|'O', winner 'X'|'O'|'draw'|null,
 * winningLine, xScore, oScore). New clients should prefer the slot-indexed
 * fields (turnSlot, winnerSlot, scores) which are emitted alongside.
 *
 * @param {Object} state Internal GameState (see shared/games/types.js)
 * @param {string[]} marks Per-slot mark/label, e.g. ['X','O'] or ['Red','Yellow'].
 * @returns {Object} Legacy wire shape
 */
function toLegacyWireState(state, marks) {
  if (!state) return {};

  const turnMark = Number.isInteger(state.turn) ? marks[state.turn] : state.turn;
  let winnerLegacy = null;
  if (state.status === 'draw') {
    winnerLegacy = 'draw';
  } else if (state.status === 'win' && (state.winner === 0 || state.winner === 1)) {
    winnerLegacy = marks[state.winner];
  }

  const scores = Array.isArray(state.scores) ? state.scores : [0, 0];

  return {
    board: state.board,
    turn: turnMark,
    winner: winnerLegacy,
    winningLine: state.winningCells || [],
    xScore: scores[0] || 0,
    oScore: scores[1] || 0,
  };
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

  const gameId = room.gameId || 'ttt';
  let rules;
  try {
    rules = getGameRules(gameId);
  } catch {
    rules = null;
  }
  const playerInfo = rules?.playerInfo || [
    { slot: 0, label: 'X', color: 'sky' },
    { slot: 1, label: 'O', color: 'rose' },
  ];
  const marks = playerInfo.map((p) => p.label || SLOT_TO_MARK[p.slot] || '');
  const boardSpec = rules?.boardSpec || null;
  const moveStyle = rules?.moveStyle || 'place';

  const wire = toLegacyWireState(room.state, marks);
  const state = room.state || {};
  const scores = Array.isArray(state.scores) ? state.scores : [0, 0];

  return {
    ...wire,
    // Slot-indexed (new) shape — preferred by game-agnostic UI code.
    turnSlot: Number.isInteger(state.turn) ? state.turn : null,
    winnerSlot: state.status === 'win' ? state.winner : (state.status === 'draw' ? 'draw' : null),
    scores: [scores[0] || 0, scores[1] || 0],
    status: state.status || 'active',
    winningCells: state.winningCells || [],
    playerInfo,
    marks,
    boardSpec,
    moveStyle,
    // Last-move ride-along — set transiently by gameHandlers#makeMove and
    // cleared by resetGame. Lets the history panel render piece-movement
    // transitions (from/to + captures) that board-diff alone can't recover.
    lastMove: room.lastMove ?? null,
    lastEvents: room.lastEvents ?? null,
    lastMoveBy: Number.isInteger(room.lastMoveBy) ? room.lastMoveBy : null,
    // Room-level (lifted out of state in Phase 2) — must still ride along
    // on the broadcast so clients pick up requests/cancellations.
    newGameRequester: room.newGameRequester ?? null,
    newGameRequestedAt: room.newGameRequestedAt ?? null,
    roomId,
    gameId,
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

// Game-related socket event handlers.
//
// As of Phase 2 of the platform refactor, this file is *game-agnostic* — it
// dispatches into shared/games via the rules registry. Game-specific behavior
// (winning lines, move shape, scoring) lives in shared/games/<id>.js.
//
// Wire-format note: the broadcast still uses the legacy 'X'/'O' / xScore /
// oScore / winningLine shape (translated in roomPublisher.js) so existing
// clients keep working until Phase 3 converts them to the slot-indexed shape.

import {
  rooms,
  touch,
  publish,
  createInitialGameState,
  DEFAULT_GAME_ID,
} from '../roomManager.js';
import { incCounter } from '../metrics.js';
import { socketLog as log } from '../logger.js';
import { validateRoomId, validateIndex, validateGameId } from './validation.js';
import { get as getGameRules } from '../../shared/games/registry.js';

/**
 * Resolve the slot (0 or 1) for the given socket in the room.
 * Returns -1 if the socket is not seated.
 *
 * Today seats are tracked as players.X / players.O. The slot mapping is
 * X→0, O→1, identical to shared/games/ttt.js SLOT_TO_MARK. When seats migrate
 * to slot-indexed storage (Phase 3+), this helper collapses to a direct lookup.
 */
function slotForSocket(room, socketId) {
  if (room.players.X === socketId) return 0;
  if (room.players.O === socketId) return 1;
  return -1;
}

/**
 * Determine the starting slot for the next game.
 * Rule (preserves legacy behavior): the slot that moved LAST in the previous
 * game does not start the next one. After a terminal move, state.turn still
 * points at the last mover (applyMove does not flip turn on terminal), so the
 * next starter is `1 - state.turn`. Holds for both wins and draws.
 *
 * If no game has finished yet, falls back to slot 0.
 */
function nextStarterSlot(prevState) {
  if (prevState?.status === 'win' || prevState?.status === 'draw') {
    return prevState.turn === 0 ? 1 : 0;
  }
  return 0;
}

/**
 * Register game-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerGameHandlers(socket, io) {
  socket.on('makeMove', ({ roomId, index, move } = {}) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);

    const rules = getGameRules(room.gameId || DEFAULT_GAME_ID);
    const slot = slotForSocket(room, socket.id);
    if (slot < 0) return;

    // Accept either the new explicit `move` payload or the legacy `{ index }`
    // shape used by TTT. New clients may send `move`; legacy clients send
    // `index` and we synthesize a place-move.
    let resolvedMove = move;
    if (!resolvedMove) {
      if (!validateIndex(index)) return;
      resolvedMove = { type: 'place', cell: index };
    }

    let result;
    try {
      result = rules.applyMove(room.state, resolvedMove, slot);
    } catch (err) {
      // Invalid move (wrong turn, occupied, out-of-range, etc). Silently drop —
      // matches the legacy gameHandlers behavior.
      log.debug('makeMove rejected', {
        roomId: normalizedRoomId, gameId: room.gameId, reason: err?.message,
      });
      return;
    }

    room.state = result.state;
    // Stash the last move + emitted events transiently on the room so
    // roomPublisher can include them on the next gameUpdate. History clients
    // need this for piece-movement games where board-diff doesn't fully
    // describe the transition (capture cells, from/to). Cleared on resetGame.
    room.lastMove = resolvedMove;
    room.lastEvents = result.events || [];
    room.lastMoveBy = slot;
    if (result.state.status === 'win' || result.state.status === 'draw') {
      incCounter('gamesCompleted');
    }

    publish(io, normalizedRoomId);
  });

  socket.on('resetGame', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);

    const prevState = room.state;
    const fresh = createInitialGameState(room.gameId);
    room.state = {
      ...fresh,
      turn: nextStarterSlot(prevState),
      scores: prevState?.scores ? [...prevState.scores] : [0, 0],
    };

    // Reset request flags are room-level, not state-level.
    room.newGameRequester = null;
    room.newGameRequestedAt = null;
    // Clear the last-move ride-along so the fresh round doesn't surface a
    // stale transition.
    room.lastMove = null;
    room.lastEvents = null;
    room.lastMoveBy = null;

    publish(io, normalizedRoomId);
    io.to(normalizedRoomId).emit('gameReset', { roomId: normalizedRoomId });
  });

  socket.on('resetScores', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.state = { ...room.state, scores: [0, 0] };
    publish(io, normalizedRoomId);
  });

  socket.on('switchGame', ({ roomId, gameId } = {}, ack) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return ack?.({ success: false, error: 'Invalid room ID' });

    const normalizedGameId = validateGameId(gameId);
    if (!normalizedGameId) return ack?.({ success: false, error: 'Invalid game' });

    const room = rooms.get(normalizedRoomId);
    if (!room) return ack?.({ success: false, error: 'Room not found' });

    touch(normalizedRoomId);

    const slot = slotForSocket(room, socket.id);
    if (slot < 0) {
      return ack?.({ success: false, error: 'Only seated players can switch games' });
    }

    if (room.gameId === normalizedGameId) {
      return ack?.({ success: true, gameId: normalizedGameId });
    }

    room.gameId = normalizedGameId;
    room.state = createInitialGameState(normalizedGameId);
    room.newGameRequester = null;
    room.newGameRequestedAt = null;
    room.lastMove = null;
    room.lastEvents = null;
    room.lastMoveBy = null;

    log.debug('Game switched', { roomId: normalizedRoomId, gameId: normalizedGameId, socketId: socket.id });

    publish(io, normalizedRoomId);
    io.to(normalizedRoomId).emit('gameReset', {
      roomId: normalizedRoomId,
      gameId: normalizedGameId,
      reason: 'gameSwitch',
    });
    ack?.({ success: true, gameId: normalizedGameId });
  });

  socket.on('requestNewGame', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.newGameRequester = socket.id;
    room.newGameRequestedAt = Date.now();
    publish(io, normalizedRoomId);
  });

  socket.on('cancelNewGameRequest', ({ roomId }) => {
    const normalizedRoomId = validateRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (!room) return;

    touch(normalizedRoomId);
    room.newGameRequester = null;
    room.newGameRequestedAt = null;
    publish(io, normalizedRoomId);
  });
}

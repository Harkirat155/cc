// Room-related socket event handlers

import { genCode } from '../gameLogic.js';
import {
  rooms,
  socketRooms,
  touch,
  publish,
  trackSocketRoom,
  createRoom,
} from '../roomManager.js';
import { socketLog as log } from '../logger.js';
import { validateRoomId, validateDisplayName } from './validation.js';

/**
 * Register room-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerRoomHandlers(socket, io) {
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

    // Create room using shared helper (handles metrics)
    createRoom(roomId, {
      creatorSocketId: socket.id,
      creatorClientId: clientId,
      creatorDisplayName: displayName,
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
    if (clientId && room.seatByClient[clientId]) {
      const seat = room.seatByClient[clientId];
      if (
        (seat === 'X' || seat === 'O') &&
        (!room.players[seat] || room.players[seat] === socket.id)
      ) {
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
}

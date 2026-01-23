// Voice-related socket event handlers

import { rooms, touch, publish } from '../roomManager.js';
import { validateRoomId } from './validation.js';

/**
 * Register voice-related event handlers
 * @param {Socket} socket - Socket instance
 * @param {Server} io - Socket.IO server instance
 */
export function registerVoiceHandlers(socket, io) {
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
}

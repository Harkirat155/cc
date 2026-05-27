// Socket event handler orchestration
// Thin wiring layer that registers all handler modules

import { publish, cleanupSocket } from './roomManager.js';
import { lobbyManager, broadcastLobbyState } from './lobbyManager.js';
import { socketLog as log } from './logger.js';
import { createRateLimitMiddleware, clearRateLimit, startRateLimitCleanup } from './rateLimiter.js';

import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerVoiceHandlers } from './handlers/voiceHandlers.js';
import { registerLobbyHandlers } from './handlers/lobbyHandlers.js';

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

    // Register domain-specific handlers
    registerRoomHandlers(socket, io);
    registerGameHandlers(socket, io);
    registerVoiceHandlers(socket, io);
    registerLobbyHandlers(socket, io);

    // Disconnect handler (cross-cutting concern)
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

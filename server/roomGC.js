// Room garbage collector
// Removes empty rooms after TTL expires

import config from './config.js';
import { rooms } from './roomManager.js';
import { roomLog as log } from './logger.js';

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

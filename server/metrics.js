// Lightweight in-memory metrics for monitoring
// No external dependencies, suitable for /health endpoint

import { rooms, socketRooms } from './roomManager.js';
import { lobbyManager } from './lobbyManager.js';
import { getRateLimitStats } from './rateLimiter.js';

// Simple counters - reset on restart (use external monitoring for persistence)
const counters = {
  roomsCreated: 0,
  gamesCompleted: 0,
  matchesMade: 0,
  feedbackReceived: 0,
  errorsLogged: 0,
};

const startTime = Date.now();

/**
 * Increment a counter
 * @param {'roomsCreated' | 'gamesCompleted' | 'matchesMade' | 'feedbackReceived' | 'errorsLogged'} name 
 */
export function incCounter(name) {
  if (Object.hasOwn(counters, name)) {
    counters[name]++;
  }
}

/**
 * Get current metric values
 */
export function getMetrics() {
  const now = Date.now();
  const memory = process.memoryUsage();
  
  // Count active rooms (with players)
  let activeRooms = 0;
  let totalPlayers = 0;
  let totalSpectators = 0;
  
  for (const room of rooms.values()) {
    const hasPlayers = !!(room.players?.X || room.players?.O);
    if (hasPlayers) activeRooms++;
    if (room.players?.X) totalPlayers++;
    if (room.players?.O) totalPlayers++;
    totalSpectators += room.spectators?.size || 0;
  }

  return {
    uptime: Math.floor((now - startTime) / 1000),
    uptimeHuman: formatUptime(now - startTime),
    
    // Room stats
    rooms: {
      total: rooms.size,
      active: activeRooms,
      empty: rooms.size - activeRooms,
    },
    
    // Player stats
    players: {
      total: totalPlayers,
      spectators: totalSpectators,
      connectedSockets: socketRooms.size,
    },
    
    // Lobby stats
    lobby: {
      queueSize: lobbyManager.getQueueSize(),
    },
    
    // Rate limiting
    rateLimiting: getRateLimitStats(),
    
    // Counters since startup
    counters: { ...counters },
    
    // Memory usage
    memory: {
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 10) / 10,
      heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024 * 10) / 10,
      rssMB: Math.round(memory.rss / 1024 / 1024 * 10) / 10,
    },
    
    // Process info
    process: {
      pid: process.pid,
      nodeVersion: process.version,
    },
  };
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Health check result
 */
export function getHealthStatus() {
  const metrics = getMetrics();
  
  // Determine health status
  const checks = {
    memory: metrics.memory.heapUsedMB < 500, // Alert if > 500MB
    rooms: metrics.rooms.total < 1000, // Alert if too many rooms
  };
  
  const healthy = Object.values(checks).every(Boolean);
  
  return {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    uptime: metrics.uptimeHuman,
    timestamp: new Date().toISOString(),
  };
}

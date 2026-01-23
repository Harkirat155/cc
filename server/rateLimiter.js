// Socket.IO rate limiter with sliding window algorithm
// Protects against spam and DoS attacks

import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('rate-limit');

// Sliding window counters: socketId -> { count, windowStart, banned, banExpires }
const socketLimits = new Map();

// Cleanup stale entries periodically
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Check if a socket is rate limited
 * @param {string} socketId 
 * @returns {{ allowed: boolean, remaining?: number, retryAfter?: number }}
 */
export function checkRateLimit(socketId) {
  const now = Date.now();
  let entry = socketLimits.get(socketId);

  // Check if currently banned
  if (entry?.banned) {
    if (now < entry.banExpires) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.banExpires - now) / 1000),
      };
    }
    // Ban expired, reset entry
    entry = null;
    socketLimits.delete(socketId);
  }

  // Initialize or reset window
  if (!entry || now - entry.windowStart >= config.rateLimitWindowMs) {
    entry = {
      count: 1,
      windowStart: now,
      banned: false,
      banExpires: 0,
    };
    socketLimits.set(socketId, entry);
    return { allowed: true, remaining: config.rateLimitMaxEvents - 1 };
  }

  // Increment counter
  entry.count++;

  // Check if over limit
  if (entry.count > config.rateLimitMaxEvents) {
    entry.banned = true;
    entry.banExpires = now + config.rateLimitBanDurationMs;
    log.warn('Socket rate limited', { socketId, count: entry.count });
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(config.rateLimitBanDurationMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: config.rateLimitMaxEvents - entry.count,
  };
}

/**
 * Remove rate limit tracking for a socket
 * @param {string} socketId 
 */
export function clearRateLimit(socketId) {
  socketLimits.delete(socketId);
}

/**
 * Get current rate limit stats
 */
export function getRateLimitStats() {
  const now = Date.now();
  let activeCount = 0;
  let bannedCount = 0;

  for (const entry of socketLimits.values()) {
    if (entry.banned && now < entry.banExpires) {
      bannedCount++;
    } else if (now - entry.windowStart < config.rateLimitWindowMs) {
      activeCount++;
    }
  }

  return {
    trackedSockets: socketLimits.size,
    activeSockets: activeCount,
    bannedSockets: bannedCount,
  };
}

/**
 * Create rate-limiting middleware for Socket.IO
 */
export function createRateLimitMiddleware() {
  return (socket, next) => {
    const originalOnEvent = socket.onevent;

    socket.onevent = function (packet) {
      const result = checkRateLimit(socket.id);

      if (!result.allowed) {
        socket.emit('error', {
          code: 'RATE_LIMITED',
          message: `Too many requests. Retry after ${result.retryAfter}s`,
          retryAfter: result.retryAfter,
        });
        return;
      }

      return originalOnEvent.call(this, packet);
    };

    next();
  };
}

// Cleanup stale entries periodically
let cleanupInterval = null;

export function startRateLimitCleanup() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [socketId, entry] of socketLimits.entries()) {
      const isStale = 
        now - entry.windowStart > config.rateLimitWindowMs * 2 &&
        (!entry.banned || now > entry.banExpires);
      
      if (isStale) {
        socketLimits.delete(socketId);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  cleanupInterval.unref?.();
}

export function stopRateLimitCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

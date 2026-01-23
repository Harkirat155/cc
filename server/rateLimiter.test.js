// Tests for rate limiter
import { describe, test, expect, beforeEach } from '@jest/globals';
import { checkRateLimit, clearRateLimit, getRateLimitStats } from './rateLimiter.js';

describe('rateLimiter', () => {
  beforeEach(() => {
    // Clear all rate limits between tests
    clearRateLimit('test-socket');
    clearRateLimit('socket-a');
    clearRateLimit('socket-b');
    clearRateLimit('socket-1');
    clearRateLimit('socket-2');
  });

  describe('checkRateLimit', () => {
    test('should allow requests under the limit', () => {
      const result = checkRateLimit('test-socket');
      expect(result.allowed).toBe(true);
      expect(typeof result.remaining).toBe('number');
    });

    test('should track multiple requests', () => {
      checkRateLimit('test-socket'); // 1
      checkRateLimit('test-socket'); // 2
      const result = checkRateLimit('test-socket'); // 3
      
      expect(result.allowed).toBe(true);
    });

    test('should block after exceeding limit', () => {
      // Default limit is 50, so we need to exceed it
      for (let i = 0; i < 55; i++) {
        checkRateLimit('test-socket');
      }
      
      const result = checkRateLimit('test-socket');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should track separate sockets independently', () => {
      // Exhaust socket-a limit
      for (let i = 0; i < 55; i++) {
        checkRateLimit('socket-a');
      }
      
      const resultA = checkRateLimit('socket-a');
      const resultB = checkRateLimit('socket-b');
      
      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    test('should clear rate limit for a socket', () => {
      for (let i = 0; i < 55; i++) {
        checkRateLimit('test-socket');
      }
      
      clearRateLimit('test-socket');
      
      const result = checkRateLimit('test-socket');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimitStats', () => {
    test('should return stats', () => {
      checkRateLimit('socket-1');
      checkRateLimit('socket-2');
      
      const stats = getRateLimitStats();
      expect(stats).toHaveProperty('trackedSockets');
      expect(stats).toHaveProperty('activeSockets');
      expect(stats).toHaveProperty('bannedSockets');
    });
  });
});

// Tests for metrics module
import { describe, test, expect } from '@jest/globals';
import { getMetrics, getHealthStatus, incCounter } from './metrics.js';

describe('metrics', () => {
  describe('getMetrics', () => {
    test('should return comprehensive metrics', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('uptimeHuman');
      expect(metrics).toHaveProperty('rooms');
      expect(metrics).toHaveProperty('players');
      expect(metrics).toHaveProperty('lobby');
      expect(metrics).toHaveProperty('rateLimiting');
      expect(metrics).toHaveProperty('counters');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('process');
    });

    test('should have room stats structure', () => {
      const metrics = getMetrics();
      
      expect(metrics.rooms).toHaveProperty('total');
      expect(metrics.rooms).toHaveProperty('active');
      expect(metrics.rooms).toHaveProperty('empty');
      expect(typeof metrics.rooms.total).toBe('number');
    });

    test('should have player stats structure', () => {
      const metrics = getMetrics();
      
      expect(metrics.players).toHaveProperty('total');
      expect(metrics.players).toHaveProperty('spectators');
      expect(metrics.players).toHaveProperty('connectedSockets');
    });

    test('should include memory usage', () => {
      const metrics = getMetrics();
      
      expect(metrics.memory).toHaveProperty('heapUsedMB');
      expect(metrics.memory).toHaveProperty('heapTotalMB');
      expect(metrics.memory).toHaveProperty('rssMB');
      expect(typeof metrics.memory.heapUsedMB).toBe('number');
    });

    test('should include process info', () => {
      const metrics = getMetrics();
      
      expect(metrics.process).toHaveProperty('pid');
      expect(metrics.process).toHaveProperty('nodeVersion');
    });
  });

  describe('getHealthStatus', () => {
    test('should return health status', () => {
      const health = getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('timestamp');
      expect(['healthy', 'degraded']).toContain(health.status);
    });

    test('should have health checks', () => {
      const health = getHealthStatus();
      
      expect(health.checks).toHaveProperty('memory');
      expect(health.checks).toHaveProperty('rooms');
    });
  });

  describe('incCounter', () => {
    test('should increment counters', () => {
      const before = getMetrics().counters.roomsCreated;
      incCounter('roomsCreated');
      const after = getMetrics().counters.roomsCreated;
      
      expect(after).toBe(before + 1);
    });

    test('should ignore invalid counter names', () => {
      // Should not throw
      expect(() => incCounter('invalidCounter')).not.toThrow();
    });
  });
});

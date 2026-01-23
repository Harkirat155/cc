// Tests for configuration module
import { describe, test, expect } from '@jest/globals';
import config, { validateConfig } from './config.js';

describe('config', () => {
  test('should have required properties', () => {
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('roomLimit');
    expect(config).toHaveProperty('roomTtlMs');
    expect(config).toHaveProperty('corsOrigin');
  });

  test('should have reasonable default values', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
    expect(config.roomLimit).toBeGreaterThan(0);
    expect(config.roomTtlMs).toBeGreaterThan(0);
  });

  test('should have environment mode properties', () => {
    expect(typeof config.isDev).toBe('boolean');
    expect(typeof config.isProd).toBe('boolean');
    expect(typeof config.isTest).toBe('boolean');
  });

  test('validateConfig should return boolean', () => {
    const result = validateConfig();
    expect(typeof result).toBe('boolean');
  });

  test('config should be frozen (immutable)', () => {
    expect(Object.isFrozen(config)).toBe(true);
  });
});

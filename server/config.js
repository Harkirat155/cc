// Centralized configuration with validation and defaults
// All settings are environment-driven with sensible defaults

const parseIntEnv = (name, defaultValue, min = 0, max = Infinity) => {
  const value = parseInt(process.env[name], 10);
  if (Number.isNaN(value)) return defaultValue;
  return Math.max(min, Math.min(max, value));
};

const parseBoolEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
};

export const config = Object.freeze({
  // Server
  port: parseIntEnv('PORT', 10000, 1, 65535),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Room management
  roomLimit: parseIntEnv('ROOM_LIMIT', 500, 10, 10000),
  roomTtlMs: parseIntEnv('ROOM_TTL_MS', 120_000, 10_000, 3600_000),
  roomGcIntervalMs: parseIntEnv('ROOM_GC_INTERVAL_MS', 10_000, 5_000, 60_000),

  // Rate limiting
  rateLimitWindowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', 1_000, 100, 60_000),
  rateLimitMaxEvents: parseIntEnv('RATE_LIMIT_MAX_EVENTS', 50, 10, 500),
  rateLimitBanDurationMs: parseIntEnv('RATE_LIMIT_BAN_DURATION_MS', 30_000, 1_000, 300_000),

  // Lobby
  lobbyMaxQueueSize: parseIntEnv('LOBBY_MAX_QUEUE_SIZE', 100, 10, 1000),
  lobbyMatchDebounceMs: parseIntEnv('LOBBY_MATCH_DEBOUNCE_MS', 100, 0, 1000),

  // Socket.IO
  socketPingTimeout: parseIntEnv('SOCKET_PING_TIMEOUT', 30_000, 5_000, 60_000),
  socketPingInterval: parseIntEnv('SOCKET_PING_INTERVAL', 25_000, 5_000, 60_000),
  socketMaxHttpBufferSize: parseIntEnv('SOCKET_MAX_HTTP_BUFFER_SIZE', 1e6, 1e4, 1e8),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableDebugLogs: parseBoolEnv('ENABLE_DEBUG_LOGS', false),

  // Graceful shutdown
  shutdownTimeoutMs: parseIntEnv('SHUTDOWN_TIMEOUT_MS', 10_000, 1_000, 60_000),

  // Feedback
  feedbackMaxEntries: parseIntEnv('FEEDBACK_MAX_ENTRIES', 200, 10, 1000),
});

// Validate critical config on startup
export function validateConfig() {
  const errors = [];
  
  if (config.roomTtlMs < config.roomGcIntervalMs) {
    errors.push('ROOM_TTL_MS should be greater than ROOM_GC_INTERVAL_MS');
  }
  
  if (config.socketPingInterval > config.socketPingTimeout) {
    errors.push('SOCKET_PING_INTERVAL should be less than SOCKET_PING_TIMEOUT');
  }

  if (errors.length > 0) {
    console.warn('[config] Configuration warnings:', errors.join('; '));
  }

  return errors.length === 0;
}

export default config;

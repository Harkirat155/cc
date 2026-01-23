// Structured logging with levels and context
// Lightweight alternative to heavy logging libraries

import config from './config.js';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info;

const formatTimestamp = () => new Date().toISOString();

const formatMessage = (level, category, message, data) => {
  const base = {
    ts: formatTimestamp(),
    level,
    cat: category,
    msg: message,
  };
  
  if (data !== undefined) {
    // In production, output JSON for log aggregation
    if (config.isProd) {
      return JSON.stringify({ ...base, data });
    }
    // In dev, output human-readable format
    return `[${base.ts}] ${level.toUpperCase()} [${category}] ${message} ${JSON.stringify(data)}`;
  }
  
  if (config.isProd) {
    return JSON.stringify(base);
  }
  return `[${base.ts}] ${level.toUpperCase()} [${category}] ${message}`;
};

const shouldLog = (level) => LOG_LEVELS[level] <= currentLevel;

/**
 * Create a logger instance for a specific category
 * @param {string} category - Log category (e.g., 'room', 'lobby', 'socket')
 */
export function createLogger(category) {
  return {
    error(message, data) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', category, message, data));
      }
    },
    warn(message, data) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', category, message, data));
      }
    },
    info(message, data) {
      if (shouldLog('info')) {
        console.info(formatMessage('info', category, message, data));
      }
    },
    debug(message, data) {
      if (shouldLog('debug') && config.enableDebugLogs) {
        console.debug(formatMessage('debug', category, message, data));
      }
    },
  };
}

// Pre-configured loggers for common categories
export const serverLog = createLogger('server');
export const roomLog = createLogger('room');
export const lobbyLog = createLogger('lobby');
export const socketLog = createLogger('socket');
export const feedbackLog = createLogger('feedback');

export default createLogger;

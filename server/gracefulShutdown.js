// Graceful shutdown handler for zero-downtime deployments
// Handles SIGTERM, SIGINT with proper cleanup

import config from './config.js';
import { serverLog as log } from './logger.js';

let isShuttingDown = false;
const shutdownCallbacks = [];

/**
 * Check if server is shutting down
 */
export function isServerShuttingDown() {
  return isShuttingDown;
}

/**
 * Register a cleanup callback to run during shutdown
 * Callbacks are executed in reverse order (LIFO)
 * @param {string} name - Identifier for logging
 * @param {Function} callback - Async cleanup function
 */
export function onShutdown(name, callback) {
  shutdownCallbacks.push({ name, callback });
}

/**
 * Execute graceful shutdown
 * @param {string} signal - The signal that triggered shutdown
 */
async function executeShutdown(signal) {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }

  isShuttingDown = true;
  log.info('Graceful shutdown initiated', { signal, pid: process.pid });

  // Set a hard timeout for cleanup
  const forceExitTimeout = setTimeout(() => {
    log.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, config.shutdownTimeoutMs);

  // Prevent the timeout from keeping the process alive if we exit cleanly
  forceExitTimeout.unref?.();

  // Execute callbacks in reverse order (LIFO)
  for (let i = shutdownCallbacks.length - 1; i >= 0; i--) {
    const { name, callback } = shutdownCallbacks[i];
    try {
      log.info(`Running shutdown callback: ${name}`);
      await callback();
      log.info(`Completed shutdown callback: ${name}`);
    } catch (error) {
      log.error(`Error in shutdown callback: ${name}`, { error: error.message });
    }
  }

  clearTimeout(forceExitTimeout);
  log.info('Graceful shutdown complete');
  process.exit(0);
}

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupGracefulShutdown() {
  // Handle SIGTERM (docker stop, kubernetes, systemd)
  process.on('SIGTERM', () => executeShutdown('SIGTERM'));
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => executeShutdown('SIGINT'));

  // Handle uncaught exceptions (log and exit)
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', { 
      error: error.message, 
      stack: error.stack 
    });
    executeShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, _promise) => {
    log.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // In production, we might want to continue running
    if (config.isProd) {
      log.warn('Continuing despite unhandled rejection (production mode)');
    } else {
      executeShutdown('unhandledRejection');
    }
  });

  log.debug('Graceful shutdown handlers registered');
}

/**
 * Create middleware that rejects new connections during shutdown
 */
export function createShutdownMiddleware() {
  return (req, res, next) => {
    if (isShuttingDown) {
      res.status(503).json({
        error: 'Server is shutting down',
        retryAfter: 5,
      });
      return;
    }
    next();
  };
}

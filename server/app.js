// Optimized Express + Socket.IO server entry point
// With graceful shutdown, metrics, structured logging, and resilience features

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';

import config, { validateConfig } from './config.js';
import { serverLog as log, feedbackLog } from './logger.js';
import { registerSocketHandlers } from './socketHandlers.js';
import { startRoomGC, stopRoomGC } from './roomManager.js';
import { addFeedback } from './feedbackStore.js';
import { appendFeedbackRow } from './googleSheetsClient.js';
import { setupGracefulShutdown, onShutdown, createShutdownMiddleware } from './gracefulShutdown.js';
import { getHealthStatus, getMetrics, incCounter } from './metrics.js';
import { stopRateLimitCleanup } from './rateLimiter.js';
import './polyfills/objectHasOwn.js';

// Validate configuration on startup
validateConfig();

const app = express();

// Parse allowed origins
const allowedOrigins = config.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Trust proxy for accurate IP when behind reverse proxy
if (config.isProd) {
  app.set('trust proxy', 1);
}

// Shutdown middleware (reject requests during shutdown)
app.use(createShutdownMiddleware());

// CORS middleware
app.use((req, res, next) => {
  const requestOrigin = req.get('origin');
  
  if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  }
  
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  return next();
});

// Compression
app.use(compression({ 
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Balanced compression level
}));

// JSON parsing with size limit
app.use(express.json({ limit: '32kb' }));

// JSON parse error handler
app.use((error, _req, res, next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  return next(error);
});

// ========== Health & Metrics Endpoints ==========

app.get('/health', (_req, res) => {
  const health = getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/metrics', (_req, res) => {
  const metrics = getMetrics();
  res.json(metrics);
});

// ========== Feedback Endpoint ==========

app.post('/feedback', async (req, res) => {
  const { rating, message, context = {} } = req.body || {};

  // Validation
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
  }

  if (typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ error: 'Feedback should be at least 5 characters long.' });
  }

  // Sanitize inputs
  const trimmedMessage = message.trim().slice(0, 2000);
  const safeRating = Math.round(numericRating * 10) / 10;
  
  const safeContext = context && typeof context === 'object'
    ? {
        roomId: typeof context.roomId === 'string' ? context.roomId.slice(0, 32) : undefined,
        isMultiplayer: Boolean(context.isMultiplayer),
        socketId: typeof context.socketId === 'string' ? context.socketId.slice(0, 48) : undefined,
        url: typeof context.url === 'string' ? context.url.slice(0, 2048) : undefined,
        userAgent: typeof context.userAgent === 'string' ? context.userAgent.slice(0, 512) : undefined,
      }
    : undefined;

  // Store feedback
  const entry = addFeedback({
    rating: safeRating,
    message: trimmedMessage,
    context: safeContext,
    meta: {
      ip: req.ip,
      origin: req.get('origin'),
      referer: req.get('referer'),
      userAgent: req.get('user-agent'),
    },
  });

  incCounter('feedbackReceived');

  if (!config.isTest) {
    const preview = trimmedMessage.length > 120
      ? `${trimmedMessage.slice(0, 117)}...`
      : trimmedMessage;
    feedbackLog.info(`${entry.rating}★ ${preview}`);
  }

  // Async sync to Google Sheets (non-blocking)
  const sheetsResult = await appendFeedbackRow({
    rating: entry.rating,
    message: entry.message,
    context: entry.context,
    meta: entry.meta,
    timestamp: entry.receivedAt,
  });

  if (!sheetsResult.success && !sheetsResult.skipped) {
    feedbackLog.error('Failed to sync with Google Sheets', { error: sheetsResult.error?.message });
  }

  return res.status(201).json({
    status: 'received',
    id: entry.id,
    sheetsSync: sheetsResult.success ? 'ok' : sheetsResult.skipped ? 'skipped' : 'failed',
  });
});

// ========== Server Setup ==========

const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: config.corsOrigin === '*' ? '*' : allowedOrigins, 
    methods: ['GET', 'POST'],
  },
  // Performance tuning
  pingTimeout: config.socketPingTimeout,
  pingInterval: config.socketPingInterval,
  maxHttpBufferSize: config.socketMaxHttpBufferSize,
  // Connection state recovery for reconnections
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// Register socket handlers
registerSocketHandlers(io);

// Start room garbage collector
startRoomGC();

// ========== Graceful Shutdown Setup ==========

setupGracefulShutdown();

// Register cleanup callbacks (LIFO order)
onShutdown('rate-limiter', async () => {
  stopRateLimitCleanup();
});

onShutdown('room-gc', async () => {
  stopRoomGC();
});

onShutdown('socket.io', async () => {
  // Notify connected clients
  io.emit('server:shutdown', { message: 'Server is restarting' });
  
  // Close all connections with timeout
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log.warn('Socket.IO close timed out, forcing resolution');
      resolve();
    }, 5000);
    
    io.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
  log.info('Socket.IO connections closed');
});

onShutdown('http-server', async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  log.info('HTTP server closed');
});

// ========== Start Server ==========

server.listen(config.port, () => {
  log.info('Server started', {
    port: config.port,
    pid: process.pid,
    nodeEnv: config.nodeEnv,
    cors: config.corsOrigin,
  });
  
  if (config.isDev) {
    console.log(`\n🎮 CrissCross server running at http://localhost:${config.port}`);
    console.log(`📊 Health check: http://localhost:${config.port}/health`);
    console.log(`📈 Metrics: http://localhost:${config.port}/metrics\n`);
  }
});

// Export for testing
export { app, server, io };

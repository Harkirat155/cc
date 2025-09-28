// Express and Socket.IO setup
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';
import { registerSocketHandlers } from './socketHandlers.js';
import { startRoomGC } from './roomManager.js';
import { addFeedback } from './feedbackStore.js';
import { appendFeedbackRow } from './googleSheetsClient.js';

if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value(obj, key) {
      return Object.prototype.hasOwnProperty.call(Object(obj), key);
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}


const PORT = process.env.PORT || 10000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();

const allowedOrigins = (CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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

app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use((error, _req, res, next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  return next(error);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/feedback', async (req, res) => {
  const { rating, message, context = {} } = req.body || {};

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res
      .status(400)
      .json({ error: 'Rating must be a number between 1 and 5.' });
  }

  if (typeof message !== 'string' || message.trim().length < 5) {
    return res
      .status(400)
      .json({ error: 'Feedback should be at least 5 characters long.' });
  }

  const trimmedMessage = message.trim().slice(0, 2000);
  const safeRating = Math.round(numericRating * 10) / 10;
  const safeContext =
    context && typeof context === 'object'
      ? {
          roomId:
            typeof context.roomId === 'string'
              ? context.roomId.slice(0, 32)
              : undefined,
          isMultiplayer: Boolean(context.isMultiplayer),
          socketId:
            typeof context.socketId === 'string'
              ? context.socketId.slice(0, 48)
              : undefined,
          url:
            typeof context.url === 'string'
              ? context.url.slice(0, 2048)
              : undefined,
          userAgent:
            typeof context.userAgent === 'string'
              ? context.userAgent.slice(0, 512)
              : undefined,
        }
      : undefined;

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

  if (process.env.NODE_ENV !== 'test') {
    const preview = trimmedMessage.length > 120
      ? `${trimmedMessage.slice(0, 117)}...`
      : trimmedMessage;
    console.info('[feedback]', `${entry.rating}★`, preview);
  }

  const sheetsResult = await appendFeedbackRow({
    rating: entry.rating,
    message: entry.message,
    context: entry.context,
    meta: entry.meta,
    timestamp: entry.receivedAt,
  });

  if (!sheetsResult.success && !sheetsResult.skipped) {
    console.error('[feedback] Failed to sync with Google Sheets', sheetsResult.error);
  }

  return res.status(201).json({
    status: 'received',
    id: entry.id,
    sheetsSync:
      sheetsResult.success
        ? 'ok'
        : sheetsResult.skipped
        ? 'skipped'
        : 'failed',
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

registerSocketHandlers(io);
startRoomGC();

server.listen(PORT, () => {
  console.log(`Realtime server listening on ${PORT}`);
});

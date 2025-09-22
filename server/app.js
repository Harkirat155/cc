// Express and Socket.IO setup
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';
import { registerSocketHandlers } from './socketHandlers.js';
import { startRoomGC } from './roomManager.js';

const PORT = process.env.PORT || 10000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(compression());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

registerSocketHandlers(io);
startRoomGC();

server.listen(PORT, () => {
  console.log(`Realtime server listening on ${PORT}`);

  // Keep-alive self-ping to prevent platform idle sleep (e.g., Render free tier)
  // Controlled via env:
  // - SELF_PING: set to '0' to disable (default enabled)
  // - SELF_PING_INTERVAL_MS: override interval (default 300000 = 5 minutes)
  const selfPingEnabled = process.env.SELF_PING !== '0';
  if (selfPingEnabled) {
  const parsedInterval = parseInt(process.env.SELF_PING_INTERVAL_MS, 10);
  const interval = isNaN(parsedInterval) ? 5 * 60 * 1000 : parsedInterval;
  const base = process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${PORT}`;
  const url = `${base.replace(/\/$/, '')}/health`;
    const ping = () => {
      try {
        http
          .get(url, (res) => {
            // Drain response to free sockets without logging noise
            res.on('data', () => {
              if (process.env.SELF_PING_DEBUG === '1') console.log('ping');
            });
            res.on('end', () => {
              if (process.env.SELF_PING_DEBUG === '1') console.log('pong');
            });
          })
          .on('error', () => {
            // Ignore errors; this is best-effort keep-alive
          });
      } catch {
        // no-op
      }
    };

    // Kick off periodic pings
    globalThis.setInterval(ping, interval);
  }
});

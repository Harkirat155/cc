// Express and Socket.IO setup
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import compression from 'compression';
import { registerSocketHandlers } from './socketHandlers.js';

const PORT = process.env.PORT || 5123;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(compression());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Realtime server listening on ${PORT}`);
});

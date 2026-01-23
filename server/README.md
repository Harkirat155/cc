# Realtime Backend

Express + Socket.IO server for Tic Tac Toe.

Features:

- Short 5-char room codes
- LRU-capped in-memory rooms (env ROOM_LIMIT, default 500)
- Spectators (third+ clients) read-only
- Turn & winner enforcement server-side
- Health endpoint /health

## Run

```bash
node server/app.js
```

Env vars (see `config.js` for full list):

- `PORT` (default 10000)
- `ROOM_LIMIT` (default 500, max simultaneous rooms)
- `ROOM_TTL_MS` (default 120000, empty room cleanup)
- `CORS_ORIGIN` (default `*`)
- `RATE_LIMIT_*` — rate limiting settings

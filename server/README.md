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
node server/server.js
```

Env vars:

- PORT (default 5123)
- ROOM_LIMIT (max simultaneous rooms)
- CORS_ORIGIN (allowed origin, default *)

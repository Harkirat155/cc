# Realtime Backend

Express + Socket.IO backend for CrissCross rooms, matchmaking, feedback, voice signaling, metrics, and public agent discovery.

## Run

```bash
nvm use --lts
npm run server
```

Default port: `10000`.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health, uptime, room/lobby status |
| `GET /metrics` | Runtime counters |
| `POST /feedback` | Feedback intake and optional Google Sheets sync |
| `GET /agent/manifest.json` | Read-only Socket.IO/game contract for agents |

## Socket.IO events

Room/game events:

- `createRoom`, `joinRoom`, `leaveRoom`
- `makeMove`, `resetGame`, `resetScores`, `switchGame`
- `requestNewGame`, `cancelNewGameRequest`, `updateDisplayName`

Lobby events:

- `joinLobby`, `leaveLobby`, `getLobbyState`
- emits `lobbyUpdate`, `matchFound`, `matchError`

Voice events:

- `voice:join`, `voice:leave`, `voice:mute-state`, `voice:signal`
- emits `voice:user-joined`, `voice:user-left`, `voice:signal`

Room state is broadcast through `gameUpdate` and reset notifications through `gameReset`.

## Game model

Server game rules come from `shared/games/`, currently:

- `ttt`
- `connect4`
- `checkers`

Rooms keep a current `gameId`, board, turn slot, winner slot, scores, roster, and rule metadata (`boardSpec`, `playerInfo`, `moveStyle`). `switchGame` resets the board for the room while preserving room membership.

## Handler pattern

Handlers in `server/handlers/*.js` should stay thin:

1. Validate inputs with `handlers/validation.js`.
2. Look up the room/lobby state.
3. `touch(roomId)` for room events.
4. Mutate state through the shared game rules.
5. `publish(io, roomId)`.

Do not bypass rate limiting or emit partial room state manually.

## Environment

Loaded through `server/config.js`:

- `PORT` (default `10000`)
- `CORS_ORIGIN` (default `*`)
- `ROOM_LIMIT` (default `500`)
- `ROOM_TTL_MS` (default `120000`)
- `RATE_LIMIT_*`
- optional Google Sheets feedback settings

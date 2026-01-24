# Copilot Instructions

CrissCross is a real-time multiplayer Tic Tac Toe app (React + Express + Socket.IO, bundled with Vite).

## Commands (always prefix with `nvm use --lts`)
- `npm run dev:all` — **Primary dev command**: runs frontend (5173) + backend (10000) concurrently
- `npm run server` — Backend only (Express + Socket.IO)
- `npm run dev` — Frontend only (Vite)
- `npm run lint` — ESLint (also `lint:frontend`, `lint:backend`)
- `npm test` — Jest tests (co-located `.test.js` files)

## Architecture Overview
```
src/                    # React frontend (Vite)
├── App.jsx            # Routes: / (Game), /room/:roomId (Game), /lobby (Lobby)
├── Game.jsx           # Main container, composes panels, handles feedback API
├── hooks/useSocketGame.js  # ALL socket + game state lives here
└── components/        # UI components (GameBoard, MenuPanel, HistoryPanel, etc.)

server/                 # Node.js backend
├── app.js             # Express entry + Socket.IO bootstrap
├── socketHandlers.js  # Socket event handlers (thin delegates to managers)
├── lobbyManager.js    # FIFO matchmaking queue
├── roomManager.js     # LRU-capped Map<roomId, RoomData>, publish()
├── config.js          # Centralized env config with validation
└── gameLogic.js       # calcWinner(), genCode(), initialState()
```

## Key Patterns

### Socket Event Names (keep client+server in sync)
- **Room**: `createRoom`, `joinRoom`, `leaveRoom`, `makeMove`, `resetGame`, `resetScores`, `requestNewGame`, `cancelNewGameRequest`
- **Lobby**: `joinLobby`, `leaveLobby` → broadcasts `lobbyUpdate`, `matchFound`, `matchError`
- **Voice**: `voice:join`, `voice:leave`, `voice:mute-state`, `voice:signal` → broadcasts `voice:user-joined`, `voice:user-left`
- **State**: server emits `gameUpdate` (room), `gameReset`, or `lobbyUpdate` (lobby)

### State Centralization
All socket and game state lives in `useSocketGame.js`. Components call actions from this hook. Never create parallel socket connections.

### Client Identity & Seat Restoration
`clientIdRef` in useSocketGame generates a stable ID stored in `sessionStorage`. Sent with `createRoom`/`joinRoom` to restore seat on refresh.

### Room Lifecycle
- 5-char codes via `genCode()` (excludes ambiguous chars: O/0/I/L)
- LRU eviction when over `ROOM_LIMIT` (default 500)
- Empty rooms garbage-collected after `ROOM_TTL_MS` (default 120s)

### Input Validation (server)
All handlers in `socketHandlers.js` validate with helpers: `validateRoomId()`, `validateDisplayName()`, `validateIndex()`. Follow this pattern for new events.

## Environment Variables
**Backend** (via `server/config.js`):
- `PORT` (default 10000), `CORS_ORIGIN`, `ROOM_LIMIT`, `ROOM_TTL_MS`
- `RATE_LIMIT_*` — socket event rate limiting

**Frontend** (Vite):
- `VITE_SOCKET_SERVER` — backend URL (defaults to port 10000 of current origin)
- `VITE_API_BASE` — REST API base (for feedback endpoint)

## Testing
- **Jest** with `@testing-library/react` for components
- Tests are co-located: `lobbyManager.test.js`, `FeedbackDialog.test.jsx`
- Mock socket with `jest.fn()` and emit handlers manually (see `socketHandlers.test.js`)
- Run single file: `npm test -- lobbyManager.test.js`

## Conventions
- **File size**: ~200 lines max; extract to hooks/utils/components
- **Styling**: Tailwind CSS inline; dark mode via `dark:` variants
- **Hooks**: Custom hooks in `src/hooks/`; utilities in `src/utils/`
- **Logging**: Use `logger.js` (server) with scoped loggers like `socketLog`, `roomLog`

## Do Not
- Change package manager (npm) or Node version tool (nvm)
- Change socket event names without updating both client and server
- Add dependencies without strong justification
- Bypass rate limiting or input validation patterns

# CLAUDE.md — Agent guide for CrissCross

Authoritative agent instructions for this repo. Keep concise; deep architecture lives in `ARCHITECTURE.md`. `.github/copilot-instructions.md` mirrors a subset for GitHub Copilot.

## What this repo is

CrissCross — real-time multiplayer board games: Tic-Tac-Toe, Connect Four, and Checkers. Stack: React 18 + Vite (frontend, port 5173), Express + Socket.IO (backend, port 10000), Tailwind CSS, WebRTC voice chat (`simple-peer`), React Router, and a shared `shared/games/` rules registry. ESM everywhere (`"type": "module"`). Deployed to GitHub Pages at base `/cc/`.

## Layout

```
src/                    # React frontend
├── App.jsx             # Routes: / & /room/:roomId → Game, /lobby → Lobby, /agents → Agents
├── Game.jsx            # Main container
├── Lobby.jsx           # Matchmaking screen
├── Agents.jsx          # Agent/LLM contract page
├── hooks/
│   ├── useSocketGame.js   # SINGLE source of truth for socket + game state
│   ├── useGameHistory.js  # Undo/replay history
│   ├── useVoiceChat.js    # WebRTC voice
│   └── useDisplayName.js
├── components/         # GameBoard, BoardSquare, ValueMark, ScorePanel, Navbar, MatchActionBar, HistoryPanel, FeedbackDialog, ...
└── utils/              # board.js, socketManager.js, clientId.js, randomName.js, history.js

shared/games/           # Rules registry for ttt/connect4/checkers

server/                 # Node backend
├── app.js              # Express + Socket.IO bootstrap
├── agentManifest.js    # Read-only agent manifest builder
├── socketHandlers.js   # Wires per-socket handlers
├── handlers/           # gameHandlers, roomHandlers, lobbyHandlers, voiceHandlers, validation
├── roomManager.js      # LRU Map<roomId, Room>, publish()
├── lobbyManager.js     # FIFO matchmaking
├── gameLogic.js        # room-code compatibility helpers
├── config.js, logger.js, metrics.js, rateLimiter.js, roomGC.js, gracefulShutdown.js
└── *.test.js           # Co-located Jest tests
```

## Commands

Always run with the repo's Node (`.nvmrc` pins version) — prefix scripts with `nvm use --lts` in shells that have nvm.

| Command | What it does |
| --- | --- |
| `npm run dev:all` | **Primary dev** — concurrent frontend (5173) + backend (10000) |
| `npm run dev` | Frontend only |
| `npm run server` | Backend only |
| `npm run lint` / `lint:fix` | ESLint (also `lint:frontend`, `lint:backend`) |
| `npm test` | Jest (co-located `*.test.js`, jsdom env for components) |
| `npm test -- <file>` | Single test file |
| `npm run build` | Vite production build |
| `npm run check` | Full preflight: lint + build + `node --check server/app.js` |

Run `npm run check` before declaring a non-trivial change complete.

## Core patterns

### Single source of socket/game state
All socket events and game state live in `src/hooks/useSocketGame.js`. Components call actions from this hook — **never** create a parallel `io()` connection or duplicate state.

Game rules live in `shared/games/` and are used by both frontend and backend. Do not add new rule logic directly to board components or socket handlers; add it to the registry and wire UI presentation through the existing game-aware helpers.

### Socket event names (client and server must agree)
- Room: `createRoom`, `joinRoom`, `leaveRoom`, `makeMove`, `resetGame`, `resetScores`, `switchGame`, `requestNewGame`, `cancelNewGameRequest`, `updateDisplayName`
- Lobby: `joinLobby`, `leaveLobby` → server emits `lobbyUpdate`, `matchFound`, `matchError`
- Voice: `voice:join`, `voice:leave`, `voice:mute-state`, `voice:signal` → server emits `voice:user-joined`, `voice:user-left`
- State broadcast: `gameUpdate` (room state), `gameReset`, `lobbyUpdate`

Adding/renaming any event requires touching **both** sides (`server/handlers/*` and `useSocketGame.js`). See the `add-socket-event` skill.

### Server handler discipline
Every handler in `server/handlers/*.js`:
1. Validates inputs via `handlers/validation.js` (`validateRoomId`, `validateDisplayName`, `validateIndex`) — return early on failure, never throw.
2. Looks up the room, returns if missing.
3. Calls `touch(roomId)` to update LRU.
4. Mutates `room.state` then calls `publish(io, roomId)` to broadcast.
5. Respects rate limits configured in `rateLimiter.js`.

### Identity and seat restoration
`clientIdRef` in `useSocketGame` is a stable id in `sessionStorage` (via `utils/clientId.js`). Sent on `createRoom`/`joinRoom` so a refresh restores the X/O seat instead of demoting to spectator.

### Room lifecycle
- 5-char codes from `genCode()` excluding ambiguous chars (`O/0/I/L`).
- LRU eviction at `ROOM_LIMIT` (default 500).
- Empty rooms GC'd after `ROOM_TTL_MS` (default 120s) by `roomGC.js`.

### State shape
```js
room.state = {
  gameId: 'ttt',
  board: [],
  turnSlot: 0,
  winnerSlot: null,
  status: 'active',
  scores: [0, 0],
  playerInfo: [],
  boardSpec: { kind: 'grid', rows: 3, cols: 3 },
  moveStyle: 'place',
  newGameRequester: socketId | null,
  newGameRequestedAt: ms | null,
}
room = { players: { X, O }, spectators, state, ... }
```

Legacy TTT fields can still exist for compatibility. New game-aware code should prefer slots, `scores`, `playerInfo`, `boardSpec`, and `moveStyle`.

## Environment

Backend (loaded via `server/config.js`, `.env` supported):
- `PORT` (default 10000), `CORS_ORIGIN`
- `ROOM_LIMIT` (500), `ROOM_TTL_MS` (120000)
- `RATE_LIMIT_*` — per-event rate limits

Frontend (Vite):
- `VITE_SOCKET_SERVER` — backend URL; defaults to port 10000 of current origin
- `VITE_API_BASE` — REST base for feedback endpoint

## Conventions

- **ESM only** — no `require()`. Server uses `.js` with ESM; Vite handles JSX.
- **File size**: aim for ≤200 lines; extract to hooks/utils/components when growing.
- **Hooks** in `src/hooks/`; **utilities** in `src/utils/`.
- **Styling**: Tailwind utility classes inline. Stone palette for surfaces (recent migration). Dark mode via `dark:` variants.
- **Logging**: use `server/logger.js` with scoped loggers (`socketLog`, `roomLog`, etc.); do not `console.log` in server code.
- **Testing**: Jest + `@testing-library/react`. Tests co-located. Mock the socket via `jest.fn()` and invoke registered handlers directly (see `socketHandlers.test.js`).
- **Imports**: relative paths in app/server code; `@shared` aliases the shared rules package for frontend imports.

## Do not

- Add a second socket connection — go through `socketManager.js` / `useSocketGame`.
- Skip input validation in a new handler — copy the validate-then-act pattern.
- Bypass rate limiting.
- Rename a socket event on one side only.
- Use `console.log` in `server/*` — use `logger.js`.
- Add a dependency without strong justification (deploy bundle and cold-start matter — see chunking in `vite.config.js`).
- Hardcode `'X'/'O'` in new game-aware code beyond compatibility surfaces. Prefer slot-indexed (`0|1`) state and `playerInfo`.
- Use `git commit --no-verify`, `git push --force`, or `rm -rf` without explicit user approval.

## Risky / shared-state actions — confirm first

PR creation, branch deletion, force-push, dependency changes, schema/contract changes (socket events, room shape), changes to CI in `.github/workflows/`. Local file edits and tests run freely.

## When planning bigger changes

Use the plan workflow (write to `/Users/singhard/.claude/plans/<slug>.md`, then `ExitPlanMode`). For new games, follow `.claude/skills/add-new-game/SKILL.md`. For new socket events, follow `.claude/skills/add-socket-event/SKILL.md`.

## References

- `ARCHITECTURE.md` — deep dive on architecture, performance, deploys.
- `README.markdown` — user-facing intro.
- `.github/copilot-instructions.md` — Copilot mirror (kept consistent with this file).
- `server/README.md` — backend specifics.

# Copilot Instructions

CrissCross is a real-time multiplayer board-game app for Tic-Tac-Toe, Connect Four, and Checkers. It uses React + Vite on the frontend, Express + Socket.IO on the backend, Tailwind CSS for styling, and `shared/games/` for rules.

## Commands (always prefix with `nvm use --lts`)

- `npm run dev:all` — primary dev command: frontend on 5173 + backend on 10000
- `npm run server` — backend only
- `npm run dev` — frontend only
- `npm run lint` — ESLint
- `npm run check` — lint + build + `node --check server/app.js`
- `npm test` — Jest tests
- `npm test -- <file>` — single test file

## Architecture overview

```text
src/
├── App.jsx                 # Routes: /, /room/:roomId, /lobby, /agents
├── Game.jsx                # Main game shell
├── Lobby.jsx               # Matchmaking page
├── Agents.jsx              # Agent/LLM contract page
├── hooks/useSocketGame.js  # Single source of socket + game state
├── components/             # Board, score, navbar, history, CTA, result, feedback
└── utils/

shared/games/               # Rules registry for ttt/connect4/checkers

server/
├── app.js                  # Express + Socket.IO bootstrap
├── agentManifest.js        # Backend agent manifest builder
├── socketHandlers.js       # Socket handler registration
├── handlers/               # Room/game/lobby/voice handlers
├── lobbyManager.js         # FIFO matchmaking queue
├── roomManager.js          # LRU rooms + publish()
└── config.js               # Env validation
```

## Key patterns

- All socket/game state lives in `src/hooks/useSocketGame.js`; never create parallel `io()` connections.
- Game rules live in `shared/games/`; do not duplicate rules in UI components or server handlers.
- Bottom match actions are derived by `src/utils/matchActions.js` and rendered by `MatchActionBar`.
- Server handlers should validate inputs, look up room, `touch(roomId)`, mutate state through rules, then `publish(io, roomId)`.
- Use `server/logger.js` in server code; no `console.log` in `server/`.

## Socket events

- Room: `createRoom`, `joinRoom`, `leaveRoom`, `makeMove`, `resetGame`, `resetScores`, `switchGame`, `requestNewGame`, `cancelNewGameRequest`, `updateDisplayName`
- Lobby: `joinLobby`, `leaveLobby`, `getLobbyState` → `lobbyUpdate`, `matchFound`, `matchError`
- Voice: `voice:join`, `voice:leave`, `voice:mute-state`, `voice:signal`
- State: `gameUpdate`, `gameReset`

## Environment

Backend:

- `PORT`, `CORS_ORIGIN`, `ROOM_LIMIT`, `ROOM_TTL_MS`, `RATE_LIMIT_*`

Frontend:

- `VITE_SOCKET_SERVER`
- `VITE_API_BASE`

## Do not

- Change package manager or Node tooling.
- Rename socket events without updating client and server together.
- Add dependencies without strong justification.
- Bypass validation, rate limiting, or the shared game registry.

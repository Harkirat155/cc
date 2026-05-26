# CrissCross Architecture

CrissCross is a React + Express + Socket.IO app for real-time two-player board games. The current codebase supports Tic-Tac-Toe, Connect Four, and Checkers through a shared rules registry.

## Runtime layout

```text
Browser (React/Vite)
  App.jsx
    /, /room/:roomId -> Game.jsx
    /lobby          -> Lobby.jsx
    /agents         -> Agents.jsx
  useSocketGame.js  -> single source of socket + game state
  components/       -> board, score, navbar, history, result, CTA

Shared rules
  shared/games/
    registry.js
    ttt.js
    connect4.js
    checkers.js

Backend (Express + Socket.IO)
  server/app.js
  server/socketHandlers.js
  server/handlers/
  server/roomManager.js
  server/lobbyManager.js
```

## Frontend flow

- `src/App.jsx` owns routing and lazy route loading.
- `src/Game.jsx` composes the game shell: navbar, selector, score panel, board, winner card, bottom match actions, history, result modal, and feedback.
- `src/hooks/useSocketGame.js` owns local state, socket connection lifecycle, room/lobby actions, and game switching. Components call hook actions; they do not create their own Socket.IO clients.
- `src/utils/socketManager.js` maintains the singleton Socket.IO client for online play.
- Board presentation is split across `GameBoard`, `BoardFrame`, `BoardSquare`, `ValueMark`, and `components/games/*` palette/presentation helpers.
- `src/components/MatchActionBar.jsx` uses `src/utils/matchActions.js` to derive a deterministic bottom CTA state. Mobile shows at most two controls and moves extra actions into an overflow menu.

## Shared games registry

Rules are registered from `shared/games/index.js` and resolved by `gameId`.

Each game supplies:

- `id` and `displayName`
- `boardSpec`
- `playerInfo`
- `moveStyle`
- initial state creation
- legal move calculation
- move application / winner detection
- move descriptions for history and agent CLI output

The registry is used by both frontend and backend. New games should be added through the shared registry and wired through existing `switchGame` flow rather than duplicating rules in the client.

## Backend flow

- `server/app.js` configures Express, compression, JSON parsing, CORS, health/metrics/feedback endpoints, and Socket.IO bootstrap.
- `server/agentManifest.js` builds the read-only `/agent/manifest.json` response.
- `server/socketHandlers.js` wires per-socket handlers and delegates to `server/handlers/*`.
- `server/roomManager.js` owns the LRU room map, room creation, `touch(roomId)`, state publication, and room garbage collection.
- `server/lobbyManager.js` owns FIFO matchmaking and preferred-game matching.
- `server/rateLimiter.js` limits socket event spam.
- `server/logger.js` is the only server logging surface.

## Room state model

Room state is game-aware and slot-based:

```js
{
  gameId: "ttt",
  board: [],
  turnSlot: 0,
  winnerSlot: null,
  status: "active",
  scores: [0, 0],
  playerInfo: [
    { slot: 0, label: "X", color: "sky" },
    { slot: 1, label: "O", color: "rose" }
  ],
  boardSpec: { kind: "grid", rows: 3, cols: 3 },
  moveStyle: "place",
  newGameRequester: null,
  newGameRequestedAt: null
}
```

Legacy TTT fields such as `turn`, `winner`, `xScore`, and `oScore` may still be present for compatibility. New game-aware code should prefer slots, `scores`, `playerInfo`, `boardSpec`, and `moveStyle`.

## Socket contract

Room events:

- `createRoom`
- `joinRoom`
- `leaveRoom`
- `makeMove`
- `resetGame`
- `resetScores`
- `switchGame`
- `requestNewGame`
- `cancelNewGameRequest`
- `updateDisplayName`

Lobby events:

- `joinLobby`
- `leaveLobby`
- `getLobbyState`

Voice events:

- `voice:join`
- `voice:leave`
- `voice:mute-state`
- `voice:signal`

Primary server broadcasts:

- `gameUpdate`
- `gameReset`
- `lobbyUpdate`
- `matchFound`
- `matchError`
- `voice:user-joined`
- `voice:user-left`
- `voice:signal`

Adding or renaming an event requires updating both `src/hooks/useSocketGame.js` / `src/hooks/socketHandlers.js` and `server/handlers/*`.

## Agent and SEO surfaces

Static frontend discovery:

- `public/robots.txt`
- `public/sitemap.xml`
- `public/llms.txt`
- `public/agent-manifest.json`
- `src/Agents.jsx`

Backend discovery:

- `GET /agent/manifest.json`

The agent contract intentionally uses the same public Socket.IO events as the browser client. Agents are non-privileged room participants.

## Validation

Use the existing scripts:

```bash
nvm use --lts
npm run check
npm test -- --runInBand
```

For agent CLI changes, also run:

```bash
node scripts/agent-play.mjs --help
```

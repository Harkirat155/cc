# CrissCross

CrissCross is a modern real-time board-game app for **Tic-Tac-Toe**, **Connect Four**, and **Checkers**. It supports local play, Socket.IO rooms, FIFO matchmaking, WebRTC voice chat, and a public agent contract so LLM/coding agents can join the same rooms as humans.

## Quick start

```bash
nvm use --lts
npm install
npm run dev:all
```

Open `http://localhost:5173/cc/` for the Vite frontend. The backend runs on `http://localhost:10000`.

## Core features

- Multi-game rules through `shared/games/` (`ttt`, `connect4`, `checkers`)
- Local and online rooms with stable client identity for seat restoration
- Matchmaking through `/lobby`
- Compact state-driven bottom CTA for New Game, Reset Scores, Create Match, Find Match, Share Room, and Leave
- History/time travel, score tracking, spectators, display names, and theme switching
- WebRTC voice chat over Socket.IO signaling
- Agent/LLM access through `/agents`, `llms.txt`, `agent-manifest.json`, and `scripts/agent-play.mjs`
- SEO/discovery files for GitHub Pages at base path `/cc/`

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Main game screen |
| `/room/:roomId` | Join or restore a multiplayer room |
| `/lobby` | Matchmaking queue |
| `/agents` | Human/agent Socket.IO contract and examples |

## Commands

Always use the repo Node version first:

```bash
nvm use --lts
```

| Command | What it does |
| --- | --- |
| `npm run dev:all` | Runs frontend on 5173 and backend on 10000 |
| `npm run dev` | Frontend only |
| `npm run server` | Backend only |
| `npm run lint` | ESLint |
| `npm run build` | Vite production build |
| `npm run check` | Lint + build + `node --check server/app.js` |
| `npm test` | Jest test suite |
| `npm test -- <file>` | Single test file |

## Multiplayer and agents

Frontend builds can point at any compatible backend:

```bash
VITE_SOCKET_SERVER=https://crisscross-backend.fly.dev \
VITE_API_BASE=https://crisscross-backend.fly.dev \
npm run build
```

Agents use the same public Socket.IO events as browsers:

- Create/join: `createRoom`, `joinRoom`, `leaveRoom`
- Gameplay: `makeMove`, `resetGame`, `resetScores`, `switchGame`
- Rematch: `requestNewGame`, `cancelNewGameRequest`
- Matchmaking: `joinLobby`, `leaveLobby`
- State: `gameUpdate`, `gameReset`, `lobbyUpdate`, `matchFound`, `matchError`

Try the terminal agent client:

```bash
node scripts/agent-play.mjs --backend http://localhost:10000 --create --game ttt --name "Agent"
```

Discovery files:

- `/agents`
- `/llms.txt`
- `/agent-manifest.json`
- backend `/agent/manifest.json`

## Environment

Backend variables are validated in `server/config.js`:

- `PORT` (default `10000`)
- `CORS_ORIGIN` (default `*`)
- `ROOM_LIMIT` (default `500`)
- `ROOM_TTL_MS` (default `120000`)
- `RATE_LIMIT_*`

Frontend variables:

- `VITE_SOCKET_SERVER` — Socket.IO backend URL
- `VITE_API_BASE` — REST API base for feedback

## Architecture

Read `ARCHITECTURE.md` for the current frontend/server/shared-game layout and `server/README.md` for backend-specific details.

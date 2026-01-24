# CrissCross — Tic Tac Toe

A minimalist, modern Tic Tac Toe game built with React and Tailwind CSS.

## TL;DR

**CrissCross** is a feature-rich Tic Tac Toe web app with:

- 🎮 **Single & Multiplayer** modes (local + realtime via Socket.IO)
- 🎯 **Matchmaking** — find random opponents instantly
- 🎤 **Voice Chat** — talk during multiplayer games
- 📱 **Responsive** — works beautifully on all devices
- 🌓 **Dark/Light** themes
- 🕹️ **History & Time Travel** — review and replay moves
- 🏆 **Score Tracking** — persistent scores across games

**Quick Start:**

```bash
nvm use --lts
npm install
npm run dev:all  # Starts both frontend (Vite) & backend (Socket.IO server)
```

Then open `http://localhost:5173` and click **"Find Match"** to play!

## Roadmap

- sound effects and haptics
- styles taken out to reusable components

## Features

- Responsive 3×3 board with smooth animations and winning-line highlight
- Top navbar with History toggle and Theme toggle (light/dark)
- Slide‑over History Panel with time‑travel and completed‑game summaries
- Bottom Menu Panel: New, Reset, Create Room, Share Link, Leave Room
- Share copies a joinable link and uses the Web Share API when available
- Auto‑join via route: open `/room/:roomId` to join that room
- Result modal with “Request/Join New Game” flow in multiplayer
- Score tracking for X and O across games until reset
- Optional real‑time multiplayer (Socket.IO) with spectators (read‑only)
- GitHub Pages friendly base path (`/crissCross`)

## Routes

- `/` — main game
- `/room/:roomId` — opens the game and automatically attempts to join `roomId`
- `/lobby` — matchmaking lobby for finding random opponents

## Usage

- Click squares to play (X starts)
- Use the menu to start a new game or reset scores
- Toggle the History panel from the navbar; time‑travel through moves
- Result modal appears at the end of the game
- Click "Find Match" to join the matchmaking queue and play against random opponents

## Matchmaking

1. Click **"Find Match"** from the main menu
2. Enter your display name (2-20 characters)
3. Wait in the lobby—you'll be automatically matched with another waiting player
4. Once matched, both players are redirected to a new game room
5. Play begins immediately with automatic role assignment (X/O)

## Multiplayer

1. Start the backend (`npm run server`) or run both with `npm run dev:all`.
1. Player 1 clicks Create Room (gets X) and shares the 5‑char code or link.
1. Player 2 joins with the code or link (gets O). Additional users join as spectators (read‑only).
1. The server enforces turns and detects wins/draws; scores persist until you reset.
1. Rooms are in‑memory and LRU‑capped; restarting the server clears them.

Frontend can point to a remote backend with an environment variable:

```bash
# Build/serve the frontend while pointing to a hosted backend
VITE_SOCKET_SERVER=https://your-backend.example.com
```

### Server environment variables

See `server/config.js` for full list with validation.

- `PORT` (default `10000`)
- `CORS_ORIGIN` (default `*`)
- `ROOM_LIMIT` (default `500`)
- `ROOM_TTL_MS` (default `120000`) — empty room cleanup delay
- `RATE_LIMIT_*` — socket event rate limiting settings

## Tech Stack

- React 18, Vite
- Tailwind CSS
- Socket.IO (client/server)
- Express (server) with compression

## Backend details

- Entry: `server/app.js`
- Health endpoint: `GET /health`
- The backend serves realtime only. Host the built frontend separately (e.g., GitHub Pages) and set `VITE_SOCKET_SERVER` to the backend URL.

## Unified Menu + Room Controls

The bottom Menu Panel includes room controls inline for a streamlined flow:

- New and Reset are always available
- Create Room appears when not in a room (local mode)
- Share appears in multiplayer and copies a joinable link (uses Web Share API when available)
- Leave Room appears in multiplayer

Buttons adapt to the current gameplay/room state. On small screens, the menu collapses to a compact “Menu” chip; tap to expand.

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

- `PORT` (default `10000` for Rust, `5123` for Node.js)
- `CORS_ORIGIN` (default `*`)
- `ROOM_LIMIT` (default `500`)

## Tech Stack

**Frontend**:
- React 18, Vite
- Tailwind CSS
- Socket.IO client

**Backend** (Two options):
1. **Rust** (Recommended) - High-performance, type-safe implementation
   - axum web framework
   - socketioxide for Socket.IO compatibility
   - tokio async runtime
   - See [server-rust/README.md](server-rust/README.md) for details

2. **Node.js** - Original JavaScript implementation
   - Express with compression
   - Socket.IO server
   - Entry: `server/app.js`

## Backend Details

### Rust Backend (Recommended)

The Rust backend provides superior performance, type safety, and reliability:

- **Entry**: `server-rust/src/main.rs`
- **Health endpoint**: `GET /health`
- **Run development**: `npm run server:rust`
- **Run production**: `npm run server:rust:release`
- **Build**: `npm run build:rust`
- **Test**: `npm run test:rust`

See [RUST_DEPLOYMENT.md](RUST_DEPLOYMENT.md) for full deployment guide.

#### Benefits of Rust Backend:
- ⚡ **2-3x faster** response times
- 💾 **50% lower** memory usage
- 🔒 **Type safety** and memory safety
- 🚀 **Higher throughput** for concurrent connections
- 🛡️ **More resilient** error handling

### Node.js Backend (Legacy)

- **Entry**: `server/app.js`
- **Health endpoint**: `GET /health`
- **Run**: `npm run server`

Both backends:
- Serve realtime only (WebSocket/Socket.IO)
- Host the built frontend separately (e.g., GitHub Pages)
- Set `VITE_SOCKET_SERVER` environment variable to point to the backend URL

## Unified Menu + Room Controls

The bottom Menu Panel includes room controls inline for a streamlined flow:

- New and Reset are always available
- Create Room appears when not in a room (local mode)
- Share appears in multiplayer and copies a joinable link (uses Web Share API when available)
- Leave Room appears in multiplayer

Buttons adapt to the current gameplay/room state. On small screens, the menu collapses to a compact “Menu” chip; tap to expand.

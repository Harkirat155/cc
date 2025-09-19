# CrissCross — Tic Tac Toe

A minimalist, modern Tic Tac Toe game built with React and Tailwind CSS.

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

## Usage

- Click squares to play (X starts)
- Use the menu to start a new game or reset scores
- Toggle the History panel from the navbar; time‑travel through moves
- Result modal appears at the end of the game

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

- `PORT` (default `5123`)
- `CORS_ORIGIN` (default `*`)
- `ROOM_LIMIT` (default `500`)

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

# Tic Tac Toe

A minimalist, modern Tic Tac Toe game built with React and Tailwind CSS. Features include:

- Responsive 3x3 game board with smooth animations
- Game history panel (collapsible, top-left)
- Menu panel (bottom, with New Game and Reset Score)
- Result modal for win/draw
- Score tracking for X and O
- Mobile-friendly, beautiful UI
- Optional real-time multiplayer (create/join room with spectators)

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the app in development (local single-device play):**

   ```bash
   npm run dev
   ```

3. **Run with realtime server (multiplayer + frontend):**

   ```bash
   npm run dev:all
   ```

4. **Build for production:**

   ```bash
   npm run build
   ```

5. **Serve production build with compression:**

   ```bash
   node server.prod.js
   ```

## Usage

- Click squares to play (X starts)
- Use the menu to start a new game or reset scores/history
- View past games in the history panel
- Result modal appears at game end

## Multiplayer Usage

1. Start backend (`npm run server`) or both (`npm run dev:all`).
2. Player 1 clicks Create Room (assigned X) and shares 5‑char code.
3. Player 2 joins with code (assigned O). Further users become spectators (read-only).
4. Server enforces turns & detects wins/draws; scores persist until reset.
5. Rooms are ephemeral (in-memory) and capped with LRU eviction; restarting server clears them.

Configure production frontend with environment variable:

```bash
VITE_SOCKET_SERVER=https://your-backend.example.com
```

## Extending

- Modular React components for easy feature additions
- Add AI, custom board sizes, theming, or persistence as needed

## License

MIT

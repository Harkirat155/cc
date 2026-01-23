# Copilot Instructions

## Project Overview

This is **CrissCross**, a modern Tic Tac Toe web app with multiplayer support.

**Tech Stack:**
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Express + Socket.IO (realtime multiplayer)
- Testing: Jest + React Testing Library
- Linting: ESLint (flat config)

## Environment & Commands

**Node Version:**
- This project uses Node LTS (specified in `.nvmrc`)
- Use `npm` only (not `yarn` or `pnpm`)

**Common Tasks:**
- Start frontend dev server: `npm run dev` (Vite on port 5173)
- Start realtime backend: `npm run server` (Express + Socket.IO on port 5123)
- Start both: `npm run dev:all` (uses `concurrently`)
- Build frontend: `npm run build`
- Preview built frontend: `npm run serve`
- Lint: `npm run lint` (or `lint:frontend`, `lint:backend`)
- Run tests: `npm test`

## Architecture

**Directory Structure:**
- `src/` — Frontend code (React components, hooks, utils)
- `server/` — Backend code (Express app, Socket.IO handlers)
- `public/` — Static assets

**Key Files:**
- `server/app.js` — Backend entry point
- `server/socketHandlers.js` — WebSocket event handlers
- `src/index.jsx` — Frontend entry point
- `src/Game.jsx` — Main game component

## Coding Standards

**React Components:**
- Use functional components only (no class components)
- Use default exports for components: `export default ComponentName`
- Use the modern JSX transform (no need to import React in JSX files)
- Prefix custom hooks with `use` (e.g., `useSocketGame`)
- Use `forwardRef` when components need ref forwarding

**File Organization:**
- Keep individual source files under ~200 lines
- When approaching the limit, extract logic into new components/hooks/utils
- Components go in `src/components/`
- Hooks go in `src/hooks/`
- Utilities go in `src/utils/`
- UI primitives go in `src/components/ui/`

**Styling:**
- Use Tailwind CSS utility classes
- Dark mode: use `dark:` prefix (dark mode is class-based: `darkMode: 'class'`)
- Create reusable component variants using JS objects (see `Button.jsx`)

**PropTypes:**
- PropTypes are disabled (`react/prop-types: off`)
- Do not add PropTypes to components

**Unused Variables:**
- Prefix unused function parameters with `_` to avoid linter warnings
- Example: `function handler(_event, data) { ... }`

**Backend (Server):**
- Use ES modules (`type: "module"` in package.json)
- Use `import`/`export`, not `require`
- Prefix environment variables with descriptive names (e.g., `PORT`, `CORS_ORIGIN`)

**Testing:**
- Write tests for new utilities and components
- Use Jest + React Testing Library
- Test files: `*.test.js` or `*.test.jsx`
- Use descriptive test names: `it('should do something specific', ...)`

## Best Practices

**Do:**
- Keep changes small and focused
- Follow existing code patterns and conventions
- Use existing UI components from `src/components/ui/`
- Maintain accessibility (ARIA labels, keyboard navigation)
- Test interactive features manually when possible

**Don't:**
- Don't introduce alternative package managers (e.g., yarn, pnpm)
- Don't change ports or public APIs unless explicitly requested
- Don't add PropTypes
- Don't use class components
- Don't switch frameworks or major libraries
- Don't commit `node_modules/`, `dist/`, or build artifacts (use `.gitignore`)

## Common Patterns

**State Management:**
- Use React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
- Complex state lives in custom hooks (see `useSocketGame.js`)

**Socket.IO:**
- Client connects via `io()` in `useSocketGame.js`
- Server handlers are in `server/socketHandlers.js`
- Events: `move`, `roomCreated`, `roomJoined`, `gameStateUpdate`, etc.

**Routing:**
- Use React Router v7
- Routes: `/` (main game), `/room/:roomId` (join room), `/lobby` (matchmaking)

## Environment Variables

**Frontend (Vite):**
- `VITE_SOCKET_SERVER` — Backend URL (default: `http://localhost:5123`)

**Backend:**
- `PORT` — Server port (default: `5123`)
- `CORS_ORIGIN` — Allowed origins (default: `*`)
- `ROOM_LIMIT` — Max rooms (default: `500`)

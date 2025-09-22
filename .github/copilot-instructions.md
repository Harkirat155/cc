# Copilot Instructions (Minimal)

This repo is a React + Express + Socket.IO app built with Vite.

General rules for commands
- Always run `nvm use --lts` before any `npm` or `node` commands.
- Use `npm` (not `yarn`/`pnpm`).

Common tasks
- Start frontend dev server: `nvm use --lts` then `npm run dev`.
- Start realtime backend: `nvm use --lts` then `npm run server` (Express + Socket.IO on port 5123).
- Start both (concurrently): `nvm use --lts` then `npm run dev:all`.
- Build frontend: `nvm use --lts` then `npm run build`.
- Preview built frontend: `nvm use --lts` then `npm run serve`.
- Lint: `nvm use --lts` then `npm run lint` (or `lint:frontend`, `lint:backend`).
- Tests: `nvm use --lts` then `npm test`.

Conventions
- Frontend lives in `src/` and is served by Vite.
- Backend lives in `server/`; main entry is `server/app.js`.
- WebSocket events are handled via Socket.IO in `server/socketHandlers.js`.
- Keep changes small and avoid framework switches.
- Keep individual source files under ~200 lines; when approaching the limit, extract logic into new components/hooks/utils (create new files on the fly and wire imports/exports accordingly).

Do not
- Do not introduce alternative package managers or Node versions.
- Do not change ports or public APIs unless asked.

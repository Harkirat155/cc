# AGENTS.md

Cross-tool agent instructions for CrissCross. This file is the shared quick reference for coding agents; tool-specific mirrors such as `.github/copilot-instructions.md` should stay aligned with this repo-wide guidance.

For full guidance — layout, commands, patterns, conventions, do-nots — read **`CLAUDE.md`** in the repo root. The sections below capture only what every coding agent (Claude Code, Codex, Cursor, Copilot, Aider, etc.) needs at a glance.

## TL;DR

- **Project**: real-time multiplayer board games (Tic-Tac-Toe, Connect Four, Checkers); React 18 + Vite frontend, Express + Socket.IO backend, Tailwind, WebRTC voice. ESM throughout. Deployed to GitHub Pages base `/cc/`.
- **Primary dev command**: `npm run dev:all` (frontend on 5173, backend on 10000).
- **Preflight before declaring done**: `npm run check` (lint + build + `node --check server/app.js`) and `npm test`.
- **Single source of truth** for socket + game state: `src/hooks/useSocketGame.js`. Do not open parallel `io()` connections.
- **Server handlers** in `server/handlers/*.js` must: validate inputs → look up room → `touch(roomId)` → mutate `state` → `publish(io, roomId)`.
- **Room game switching** uses the `switchGame` socket event; keep it in the centralized `useSocketGame.js` flow and server game handlers.
- **Logging**: `server/logger.js` only (no `console.log` in `server/`).
- **Game rules**: `shared/games/` is the shared rules registry. Do not duplicate rules in the client or server; add/switch games through the registry and the centralized `switchGame` flow.

## Required reading before non-trivial changes

1. `CLAUDE.md` — patterns, socket event names, room lifecycle, environment, conventions.
2. `ARCHITECTURE.md` — deep architecture, deploys, performance.
3. `server/README.md` — backend specifics.

## Project-specific skills

Workflow guides for recurring tasks live under `.claude/skills/`. Read the relevant `SKILL.md` before starting:

- `.claude/skills/add-new-game/SKILL.md` — adding a new two-player game through the shared rules registry.
- `.claude/skills/add-socket-event/SKILL.md` — adding a new client⇄server socket event end-to-end.

## Safety defaults

- Confirm before: PR creation, force-push, branch deletion, dependency changes, socket-contract changes, CI workflow edits.
- Never use `git commit --no-verify`, `--no-gpg-sign`, or `git push --force` without explicit user approval.
- Match scope to the request — don't refactor surroundings or add abstractions a bug fix doesn't require.

## Style

- Default to **no code comments**; add one only when the *why* is non-obvious.
- Don't write planning, summary, or change-log docs unless the user asks.
- Prefer editing existing files to creating new ones.
- File size target ≤200 lines; extract when growing.

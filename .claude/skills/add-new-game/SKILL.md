---
name: add-new-game
description: Add a new two-player game (e.g. Connect Four, Gomoku, Checkers) to the CrissCross platform. Use when the user asks to add, register, or wire up a new game type, or to migrate the existing Tic-Tac-Toe into the shared rules registry. Assumes the platform refactor in /Users/singhard/.claude/plans/can-you-review-this-immutable-biscuit.md is the target architecture.
---

# Adding a new game

The repo currently hosts only Tic-Tac-Toe with hardcoded rules on both server and client. The target architecture pulls every game's rules into `shared/games/` so server and client import the **same** module. Follow these steps in order — skipping the abstraction work and re-hardcoding a second game multiplies the duplication problem.

## Pre-flight

- Read `CLAUDE.md` (socket events, room shape, handler discipline).
- Read the roadmap at `/Users/singhard/.claude/plans/can-you-review-this-immutable-biscuit.md`.
- Confirm with the user which game and which phase (one-off adapter vs. platform refactor).

## Step 1 — Ensure shared abstractions exist

If `shared/games/` does **not** exist yet, build it first (do not add the new game directly into `server/gameLogic.js` or `useSocketGame.js`):

1. Create `shared/games/types.js` with JSDoc typedefs: `BoardSpec`, `Move`, `GameState`, `Player`.
2. Create `shared/games/rules.js` defining the `GameRules` contract:
   ```js
   // GameRules { id, displayName, players: 2,
   //   createInitialState(): GameState,
   //   getLegalMoves(state, slot): Move[],
   //   applyMove(state, move, slot): { state, events },
   //   checkTerminal(state): { status, winner?, line? },
   //   describeMove(move): string }
   ```
3. Create `shared/games/registry.js` exposing `register(rules)` and `get(id)`.
4. Add Vite alias `@shared` → `<root>/shared` in `vite.config.js`. Server imports via relative path.
5. Port TTT first: extract `LINES`/`calcWinner`/`initialState` from `server/gameLogic.js` into `shared/games/ttt.js` as a `GameRules` impl. Keep behavior bit-identical.
6. Replace the duplicated rules in `src/hooks/useSocketGame.js:22-49` with `registry.get('ttt')`. Verify TTT still plays end-to-end locally and over a multiplayer room.

Only proceed once TTT works through the abstraction.

## Step 2 — Implement the new game module

Create `shared/games/<gameId>.js` exporting a `GameRules` implementation:

- **`id`**: short slug (`'connect4'`, `'gomoku'`, `'checkers'`).
- **`displayName`**: shown in UI.
- **`createInitialState()`**: returns `{ board, turn: 0, status: 'active', winner: null, winningCells: [], scores: [0, 0], moveCount: 0, boardSpec: {...} }`.
- **`getLegalMoves(state, slot)`**: returns `Move[]`. For grid-mark games, `Move = { type: 'place', cell: index }`. For piece-movement, `Move = { type: 'transfer', from, to, captures?: [] }`.
- **`applyMove(state, move, slot)`**: returns `{ state: newState, events: [{ type, affectedCells: [...] }] }`. **Immutable** — clone state; do not mutate the input.
- **`checkTerminal(state)`**: returns `{ status: 'active'|'win'|'draw', winner?: 0|1, line?: number[] }`.
- **`describeMove(move)`**: human string for the history panel ("X plays center", "Red drops column 4", "Black 12→19").

Register it in `shared/games/registry.js` (or via a side-effecting import in a barrel file).

### Sanity tests (`shared/games/__tests__/<gameId>.test.js`)

At minimum:
- `createInitialState()` shape matches contract; scores are `[0, 0]`; turn is `0`.
- `getLegalMoves` on the initial state returns the expected count (TTT: 9, Connect Four: 7, Checkers: 7).
- `applyMove` is immutable (input unchanged) and increments `moveCount`, flips `turn`.
- Each win condition is detected: build a state one move away from each terminal kind (horizontal, vertical, diagonal, etc.).
- Draw detection.
- Illegal move rejection.

Run via `npm test`.

## Step 3 — Server wiring

- `server/handlers/gameHandlers.js`: ensure `makeMove({ roomId, move })` resolves `rules = registry.get(room.gameId)` and calls `rules.applyMove` + `rules.checkTerminal`. No game-specific code in this file.
- `server/roomManager.js`: `room.gameId` field stored at room creation; `room.state = rules.createInitialState()`.
- `server/handlers/roomHandlers.js`: `createRoom({ gameId })` validates `gameId` against the registry; default to `'ttt'` for back-compat.
- `server/handlers/validation.js`: add `validateGameId(id)` (registry membership check).
- Bump `protocolVersion` on the socket handshake if the move payload shape changes.

## Step 4 — Client wiring

- `src/hooks/useSocketGame.js`: pass `gameId` through `createRoom`/`joinRoom`; resolve `rules` from `gameId`; both online and local-fallback paths call `rules.applyMove`.
- `src/components/GameSelector.jsx`: add the new game to the create-room screen.
- `src/components/BoardRenderer.jsx`: should handle the new `BoardSpec` without modification (grid kind covers TTT, Connect Four, Gomoku). For piece-movement, it must support **two-step input** (click-select → click-target) — extend the hook with `selection` state and use `rules.getLegalMoves(state, slot, from)` for highlight hints.
- `src/components/PieceRenderer.jsx`: pieces declare `{ type, owner }`; colors come from player-slot palette, not literal `'X'/'O'`.
- `src/components/ScorePanel.jsx`: key panels by `players[0]/players[1]` slot labels from the rules module.
- `src/components/ResultModal.jsx`: render `winner.label` via slot.
- `src/hooks/useGameHistory.js`: `recordMove(move, stateBefore, stateAfter)`; render via `rules.describeMove(move)`.

## Step 5 — Verification

1. `npm run lint && npm test && npm run build` all green.
2. `npm run dev:all`, open two browsers, create a room for the new game, play through a win and a draw, refresh mid-game (seat restoration must work), test reset, test new-game request.
3. Spectator joins mid-game and sees the correct board.
4. Move history replay (jump to a prior move, resume to latest) works for the new game.
5. For piece-movement games: deselect, illegal target, multi-capture, promotion all behave correctly.
6. Confirm TTT still works — regression check.

## Common pitfalls

- **Don't** copy/paste rules into both server and client — import the same `shared/games/<gameId>.js`.
- **Don't** mutate state inside `applyMove`. The history hook diffs by reference.
- **Don't** assume `players === 2` everywhere implies marks `'X'/'O'`; key by slot (0/1).
- **Don't** add a new socket event for the new game; the generic `makeMove` is sufficient.
- **Do** add the game to the rate-limit defaults if move cadence differs from TTT.
- **Do** verify `protocolVersion` rejects mismatched old clients after deploy.

## When unsure

Ask the user before:
- Changing the `GameRules` contract (it affects every game).
- Introducing async rule logic (none of the current games need it).
- Adding a backend-only rule (AI opponent, server-side legal-move enforcement beyond turn/cell checks).

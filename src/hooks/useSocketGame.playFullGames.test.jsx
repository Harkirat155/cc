/**
 * End-to-end "play a full game" integration tests for the local-mode UX.
 *
 * Drives the same hook (useSocketGame.handleSquareClick) that the GameBoard
 * UI invokes on click, so this exercises rules ↔ hook ↔ legacy-shape wiring
 * for every supported game. Covers:
 *   - TTT: slot-0 wins top row; scores update
 *   - TTT: full board draw
 *   - Connect-4: vertical 4-in-a-column win
 *   - Checkers: select-then-target step move
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@shared/games/index.js";

jest.mock("../utils/socketManager", () => ({
  getSocket: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: false }),
  waitForConnection: () => Promise.resolve({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: false }),
  isConnected: () => false,
  getSocketId: () => null,
  addListener: () => () => {},
}));

import useSocketGame from "./useSocketGame";

function setSearch(qs) {
  window.history.replaceState({}, "", qs ? `/${qs.startsWith("?") ? qs : `?${qs}`}` : "/");
}

async function mount(qs) {
  setSearch(qs);
  let snapshot;
  function Probe() {
    const game = useSocketGame();
    snapshot = game;
    return <div data-testid="ready">{game.gameState.gameId}</div>;
  }
  await act(async () => {
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
  });
  return () => snapshot;
}

async function click(snap, index) {
  await act(async () => {
    snap().handleSquareClick(index);
  });
}

describe("useSocketGame — full local game playthroughs", () => {
  test("TTT: slot 0 wins the top row, score updates", async () => {
    const snap = await mount("");
    expect(snap().gameState.gameId).toBe("ttt");
    // X at 0, O at 3, X at 1, O at 4, X at 2 → top-row win for X.
    await click(snap, 0);
    expect(snap().gameState.board[0]).toBe("X");
    expect(snap().gameState.turnSlot).toBe(1);
    await click(snap, 3);
    await click(snap, 1);
    await click(snap, 4);
    await click(snap, 2);
    expect(snap().gameState.winner).toBe("X");
    expect(snap().gameState.winnerSlot).toBe(0);
    expect(snap().gameState.winningCells).toEqual([0, 1, 2]);
    expect(snap().gameState.scores).toEqual([1, 0]);
  });

  test("TTT: full board with no winner ends in a draw", async () => {
    const snap = await mount("");
    // Final layout:  X X O
    //                O O X
    //                X O X
    // Move order: 0,2,1,4,8,7,6,3,5
    const moves = [0, 2, 1, 4, 8, 7, 6, 3, 5];
    for (const m of moves) await click(snap, m);
    expect(snap().gameState.winner).toBe("draw");
    expect(snap().gameState.status).toBe("draw");
    expect(snap().gameState.scores).toEqual([0, 0]);
  });

  test("Connect-4: vertical four-in-a-column wins for slot 0", async () => {
    const snap = await mount("?game=connect4");
    expect(snap().gameState.gameId).toBe("connect4");
    // Slot 0 stacks col 0; slot 1 stacks col 1.
    // After three S0 drops + three S1 drops, S0's fourth chip wins vertically.
    // Click any cell within a column — rules.moveFromCellClick translates.
    const COLS = 7;
    const colCell = (col, row) => row * COLS + col;
    await click(snap, colCell(0, 5)); // S0 col 0
    await click(snap, colCell(1, 5)); // S1 col 1
    await click(snap, colCell(0, 5)); // S0 col 0 (click anywhere in col 0; lands above)
    await click(snap, colCell(1, 5));
    await click(snap, colCell(0, 5));
    await click(snap, colCell(1, 5));
    await click(snap, colCell(0, 5)); // 4th in col 0 → win
    expect(snap().gameState.winnerSlot).toBe(0);
    expect(snap().gameState.status).toBe("win");
    // Winning cells are the four cells in col 0, rows 5..2.
    const expectedWin = [5, 4, 3, 2].map((r) => colCell(0, r));
    expect(snap().gameState.winningCells.sort()).toEqual(expectedWin.sort());
    expect(snap().gameState.scores).toEqual([1, 0]);
  });

  test("Checkers: select piece then complete a forward step move", async () => {
    const snap = await mount("?game=checkers");
    expect(snap().gameState.gameId).toBe("checkers");
    // Slot-0 man at (5,0) = idx 40. Legal forward step → (4,1) = idx 33.
    await click(snap, 40); // select
    expect(snap().gameState.board[40]).toEqual({ type: "man", owner: 0 });
    await click(snap, 33); // target
    expect(snap().gameState.board[40]).toBe("");
    expect(snap().gameState.board[33]).toEqual({ type: "man", owner: 0 });
    expect(snap().gameState.turnSlot).toBe(1);
    // Pieces still 24 in total — no capture yet.
    const pieces = snap().gameState.board.filter(
      (c) => c && typeof c === "object"
    ).length;
    expect(pieces).toBe(24);
  });
});

// Silence unused-import warning if any test environment trips on it.
void screen;

describe("useSocketGame — displayedBoard size matches active game on first render", () => {
  test("Connect-4 displayedBoard has 42 cells before any move", async () => {
    const snap = await mount("?game=connect4");
    expect(snap().displayedBoard.length).toBe(42);
  });
  test("Checkers displayedBoard has 64 cells before any move", async () => {
    const snap = await mount("?game=checkers");
    expect(snap().displayedBoard.length).toBe(64);
  });
  test("TTT displayedBoard has 9 cells before any move", async () => {
    const snap = await mount("");
    expect(snap().displayedBoard.length).toBe(9);
  });
});

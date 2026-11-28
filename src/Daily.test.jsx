import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Daily from "./Daily";
import { puzzleForDate, keepsWin, defenderReply } from "@shared/daily.js";
import connect4 from "@shared/games/connect4.js";

const DATE = "2026-11-28";
const show = () => render(<MemoryRouter><Daily /></MemoryRouter>);
const drop = (col) => fireEvent.click(screen.getByRole("button", { name: `Drop piece in column ${col + 1}` }));
const COLS = [0, 1, 2, 3, 4, 5, 6];
const put = (board, col, mark) => {
  const row = [5, 4, 3, 2, 1, 0].find((r) => board[r * 7 + col] === "");
  board[row * 7 + col] = mark;
};

// Plays the puzzle's winning line through the page, mirroring the defender with the shared engine.
function solve(p) {
  const board = p.board.slice();
  let left = p.n;
  for (;;) {
    const col = COLS.find((c) => board[c] === "" && keepsWin(board, c, p.turn, left));
    drop(col);
    put(board, col, ["R", "Y"][p.turn]);
    if (connect4.checkTerminal({ board }).status === "win") return;
    put(board, defenderReply(board, p.turn, left - 1), ["R", "Y"][1 - p.turn]);
    left -= 1;
  }
}

const slip = (p) => COLS.find((c) => p.board[c] === "" && !keepsWin(p.board, c, p.turn, p.n));

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers({ now: new Date(`${DATE}T10:00:00Z`), doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask"] });
});
afterEach(() => jest.useRealTimers());

describe("daily page", () => {
  it("says the rule in words", () => {
    show();
    expect(screen.getByText("One puzzle a day, the same for everyone. New puzzle at 00:00 UTC.")).toBeTruthy();
  });

  it("a move that lets the win slip says so and offers Try again", () => {
    const p = puzzleForDate(DATE);
    show();
    drop(slip(p));
    expect(screen.getByText("That lets them off the hook")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText("That lets them off the hook")).toBeNull();
  });

  it("the winning line shows solved and the result line with the try count", () => {
    const p = puzzleForDate(DATE);
    show();
    drop(slip(p));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    solve(p);
    expect(screen.getByText("CrissCross daily 2026-11-28 · solved in 2 tries · harkirat155.github.io/cc/daily")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("a reload keeps today's solved state, and a new UTC day starts fresh", () => {
    const p = puzzleForDate(DATE);
    const first = show();
    solve(p);
    first.unmount();
    const second = show();
    expect(screen.getByText("CrissCross daily 2026-11-28 · solved in 1 try · harkirat155.github.io/cc/daily")).toBeTruthy();
    second.unmount();
    jest.setSystemTime(new Date("2026-11-29T00:00:01Z"));
    show();
    expect(screen.queryByText(/solved in/)).toBeNull();
  });

  it("falls back to a hand-copy field when the clipboard refuses", async () => {
    const p = puzzleForDate(DATE);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error("no")) } });
    show();
    solve(p);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect((await screen.findByLabelText("Result line")).value).toMatch(/^CrissCross daily 2026-11-28/);
  });
});

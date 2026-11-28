import React from "react";
import { render, screen } from "@testing-library/react";
import GameBoard from "./GameBoard";

const ROWS = 6;
const COLS = 7;
const spec = { rows: ROWS, cols: COLS };
const info = [{ label: "Red", slot: 0 }, { label: "Yellow", slot: 1 }];
const empty = () => Array(ROWS * COLS).fill(null);
// put(board, col, value...) drops discs bottom to top, like gravity.
const drop = (board, col, ...values) => {
  const next = [...board];
  values.forEach((v) => {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!next[r * COLS + col]) { next[r * COLS + col] = v; break; }
    }
  });
  return next;
};
const renderBoard = (squares) => {
  const ui = (s) => (
    <GameBoard squares={s} onSquareClick={() => {}} rows={ROWS} cols={COLS} boardSpec={spec} playerInfo={info} />
  );
  const view = render(ui(squares));
  return { ...view, update: (s) => view.rerender(ui(s)) };
};

test("each column names its discs bottom to top and the drop action", () => {
  renderBoard(drop(empty(), 2, "Red", "Yellow"));
  expect(
    screen.getByRole("button", { name: "Column 3: red, yellow, 4 empty. Drop piece in column 3" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Column 1: 6 empty. Drop piece in column 1" })
  ).toBeInTheDocument();
});

test("a full column says full and is not offered as a drop", () => {
  renderBoard(drop(empty(), 0, "Red", "Yellow", "Red", "Yellow", "Red", "Yellow"));
  const full = screen.getByRole("button", { name: "Column 1: red, yellow, red, yellow, red, yellow, full" });
  expect(full).toBeDisabled();
  expect(full.getAttribute("aria-label")).not.toMatch(/Drop piece/);
});

test("the last move is announced politely once, not on re-render", () => {
  const first = drop(empty(), 3, "Red");
  const { update } = renderBoard(first);
  const live = () => document.querySelector('[aria-live="polite"]');
  expect(live()).toHaveTextContent("");
  const second = drop(first, 3, "Yellow");
  update(second);
  expect(live()).toHaveTextContent("Yellow dropped in column 4");
  update([...second]); // same board, new array: no new move
  expect(live()).toHaveTextContent("Yellow dropped in column 4");
  const third = drop(second, 0, "Red");
  update(third);
  expect(live()).toHaveTextContent("Red dropped in column 1");
});

test("a move and its answer landing together, or a cleared board, announce nothing", () => {
  const first = drop(empty(), 3, "Red");
  const { update } = renderBoard(first);
  const live = () => document.querySelector('[aria-live="polite"]');
  update(drop(first, 3, "Yellow"));
  expect(live()).toHaveTextContent("Yellow dropped in column 4");
  update(drop(drop(first, 3, "Yellow"), 5, "Red", "Yellow")); // two new discs at once: the page narrates them
  expect(live()).toHaveTextContent("Yellow dropped in column 4");
  update(empty()); // new game
  expect(live()).toHaveTextContent("");
});

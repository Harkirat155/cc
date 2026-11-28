import React from "react";
import { render, screen, act } from "@testing-library/react";
import ScorePanel from "./ScorePanel";

const gameState = { gameId: "ttt", status: "active", scores: [0, 0], turnSlot: 0, turn: "X" };
const roster = { X: "a", O: "b", XName: "Alice", OName: "Bob" };
const show = (emote) =>
  render(<ScorePanel gameState={gameState} roster={roster} socketId="a" isMultiplayer displayName="Alice" onUpdateDisplayName={jest.fn()} emote={emote} />);

test("a reaction shows beside the sender's seat only, in a polite status with the sentence, and vanishes after 3 s", () => {
  jest.useFakeTimers();
  show({ slot: 1, emote: "😮", id: 1 });
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Bob reacted 😮");
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(status.querySelector(".sr-only")).toHaveTextContent("Bob reacted 😮");
  expect(status.closest("div.relative")).toHaveTextContent("Bob");
  expect(status.closest("div.relative")).not.toHaveTextContent("Alice");
  act(() => { jest.advanceTimersByTime(2900); });
  expect(screen.queryByRole("status")).not.toBeNull();
  act(() => { jest.advanceTimersByTime(150); });
  expect(screen.queryByRole("status")).toBeNull();
  jest.useRealTimers();
});

/**
 * @jest-environment-options {"url": "https://harkirat155.github.io/cc/"}
 */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Rush from "./Rush";
import { rushPuzzle } from "@shared/rush.js";

const DAY = "2026-11-28";
const show = () => render(<MemoryRouter><Rush /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers({ now: new Date(`${DAY}T10:00:00Z`) });
  window.navigator.sendBeacon = jest.fn(() => true);
});
afterEach(() => jest.useRealTimers());

const beacons = () => window.navigator.sendBeacon.mock.calls.map(([u]) => new window.URL(u).searchParams.get("e"));
// puzzle 0 is Tic-Tac-Toe: click the answer cell
const solveFirst = () => {
  const i = rushPuzzle(DAY, 0).answers[0];
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Square row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1} `) }));
};

describe("rush page", () => {
  it("starts, scores a solve, ends at 3 minutes, keeps the best and shares", async () => {
    show();
    expect(screen.getByText(/3 minutes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(beacons()).toContain("rush_start");
    expect(screen.getByText("Solved 0")).toBeTruthy();
    solveFirst();
    expect(screen.getByText("Solved 1")).toBeTruthy();
    act(() => { jest.advanceTimersByTime(181000); });
    expect(screen.getByText(/You solved 1 puzzle/)).toBeTruthy();
    expect(beacons()).toContain("rush_finish");
    expect(JSON.parse(window.localStorage.getItem("cc.rush"))).toEqual({ date: DAY, best: 1 });
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(window.navigator, { share: undefined, clipboard: { writeText } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Share result" })); });
    expect(writeText.mock.calls[0][0]).toMatch(/^I solved 1 puzzles? in 3 minutes on CrissCross Rush\nhttps:\/\/harkirat155\.github\.io\/cc\/rush$/);
  });

  it("a wrong move skips to the next puzzle without a point", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const p = rushPuzzle(DAY, 0);
    const i = p.board.findIndex((v, c) => v === "" && !p.answers.includes(c));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Square row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1} `) }));
    expect(screen.getByText("Solved 0")).toBeTruthy();
    expect(screen.getByText("Missed, next puzzle")).toBeTruthy();
    expect(screen.getByText(/^Connect Four\./)).toBeTruthy();
  });
});

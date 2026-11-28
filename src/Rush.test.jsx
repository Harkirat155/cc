/**
 * @jest-environment-options {"url": "https://harkirat155.github.io/cc/"}
 */
import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Rush from "./Rush";
import { rushPuzzle, rushSolve } from "@shared/rush.js";

const DAY = "2026-11-28";
const Where = () => <output data-testid="where">{useLocation().search}</output>;
const show = (search = "") => render(<MemoryRouter initialEntries={[`/rush${search}`]}><Rush /><Where /></MemoryRouter>);

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

  describe("beat challenge", () => {
    const finish = () => {
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      solveFirst();
      act(() => { jest.advanceTimersByTime(181000); });
    };

    it("copies a ?beat=N link with the score and tallies it, when sharing is unavailable", async () => {
      show();
      finish();
      const writeText = jest.fn(() => Promise.resolve());
      Object.assign(window.navigator, { share: undefined, clipboard: { writeText } });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Challenge a friend" })); });
      expect(writeText).toHaveBeenCalledWith("https://cc-api.harkirat-hira.workers.dev/b/1");
      expect(screen.getByText("Link copied")).toBeTruthy();
      expect(beacons()).toContain("rush_beat_link");
    });

    it("uses the share sheet when there is one", async () => {
      show();
      finish();
      const share = jest.fn(() => Promise.resolve());
      Object.assign(window.navigator, { share });
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Challenge a friend" })); });
      expect(share.mock.calls[0][0].url).toBe("https://cc-api.harkirat-hira.workers.dev/b/1");
      expect(beacons()).toContain("rush_beat_link");
    });

    it("counts an arrival through a /b/ card once, and drops the marker but keeps the target", () => {
      show("?beat=7&via=b");
      expect(beacons().filter((e) => e === "rush_beat_arrival")).toHaveLength(1);
      expect(screen.getByTestId("where").textContent).toBe("?beat=7");
      expect(screen.getByText("Beat 7")).toBeTruthy();
    });

    it("counts no arrival without the marker or with another one", () => {
      show("?beat=7");
      show("?beat=7&via=j");
      expect(beacons()).not.toContain("rush_beat_arrival");
    });

    it("offers no challenge after a run that solved nothing", () => {
      show();
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      act(() => { jest.advanceTimersByTime(181000); });
      expect(screen.queryByRole("button", { name: "Challenge a friend" })).toBeNull();
    });

    it("shows the target, then whether it was beaten, tied or missed", () => {
      show("?beat=1");
      expect(screen.getByText("Beat 1")).toBeTruthy();
      finish();
      expect(screen.getByText("You tied 1, one more beats it")).toBeTruthy();
    });

    it("says the target was missed when nothing was solved", () => {
      show("?beat=1");
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      act(() => { jest.advanceTimersByTime(181000); });
      expect(screen.getByText("Not beaten: 0 against 1")).toBeTruthy();
    });

    it.each(["abc", "0", "1000", "-3", "2.5", "1e2", ""])("ignores beat=%s", (v) => {
      show(`?beat=${v}`);
      expect(screen.queryByText(/^Beat \d/)).toBeNull();
    });

    it("says the target was beaten when the score is higher", () => {
      show("?beat=1");
      fireEvent.click(screen.getByRole("button", { name: "Start" }));
      solveFirst();
      rushSolve(rushPuzzle(DAY, 1)).forEach((col) => {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Column ${col + 1}: `) }));
      });
      expect(screen.getByText("Solved 2")).toBeTruthy();
      act(() => { jest.advanceTimersByTime(181000); });
      expect(screen.getByText("You beat 1 with 2")).toBeTruthy();
    });
  });
});

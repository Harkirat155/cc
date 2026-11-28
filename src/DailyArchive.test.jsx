import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Daily from "./Daily";
import DailyArchive from "./DailyArchive";

jest.mock("./lib/tally", () => ({ tally: jest.fn() }));
const { tally } = require("./lib/tally");

const show = (path = "/daily/archive") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/daily" element={<Daily />} />
      <Route path="/daily/archive" element={<DailyArchive />} />
      <Route path="/daily/:date" element={<Daily />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.localStorage.clear();
  tally.mockClear();
  jest.useFakeTimers({ now: new Date("2026-11-30T10:00:00Z"), doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask"] });
});
afterEach(() => jest.useRealTimers());

describe("daily archive", () => {
  it("labels solved, tried and not tried from this device's record and counts one open", () => {
    window.localStorage.setItem("cc.daily", JSON.stringify({ date: "2026-11-30", tries: 1, solved: false, days: ["2026-11-27"], pastTries: { "2026-11-28": 2 } }));
    show();
    expect(screen.getByRole("link", { name: "27 November, Connect Four, solved" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "28 November, Connect Four, tried" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "29 November, Connect Four, not tried" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "30 November, Tic-Tac-Toe, not tried" })).toBeTruthy();
    expect(screen.getByText(/Solved on this device: 1 of 4 days/)).toBeTruthy();
    expect(tally).toHaveBeenCalledTimes(1);
    expect(tally).toHaveBeenCalledWith("cc", "daily_archive");
  });

  it("links days to their puzzle, today to /daily; pre-launch and future days are not links", () => {
    show();
    expect(screen.getByRole("link", { name: /^27 November/ }).getAttribute("href")).toBe("/daily/2026-11-27");
    expect(screen.getByRole("link", { name: /^30 November/ }).getAttribute("href")).toBe("/daily");
    expect(screen.queryByRole("link", { name: /^26 November/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^1 December/ })).toBeNull();
    expect(screen.getAllByRole("link").filter((a) => /\d{1,2} (November|December)/.test(a.getAttribute("aria-label") || ""))).toHaveLength(4);
  });

  it("is not read as a date by the router", () => {
    show();
    expect(screen.getByRole("heading", { name: "Past puzzles" })).toBeTruthy();
    expect(screen.queryByText(/isn't available/)).toBeNull();
  });

  it("is reachable from /daily by a quiet link", () => {
    show("/daily");
    expect(screen.getByRole("link", { name: "Past puzzles" }).getAttribute("href")).toBe("/daily/archive");
  });
});

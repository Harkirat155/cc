import React from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Daily, { shareText } from "./Daily";
import { puzzleForDate, keepsWin, defenderReply } from "@shared/daily.js";
import connect4 from "@shared/games/connect4.js";

const DATE = "2026-11-28";
const show = () => render(<MemoryRouter><Daily /></MemoryRouter>);
const drop = (col) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`Drop piece in column ${col + 1}$`) }));
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
    expect(screen.getByText("CrissCross Daily 2026-11-28 · solved in 2 tries https://cc-api.harkirat-hira.workers.dev/d/2026-11-28")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share result" })).toBeTruthy();
  });

  it("a reload keeps today's solved state, and a new UTC day starts fresh", () => {
    const p = puzzleForDate(DATE);
    const first = show();
    solve(p);
    first.unmount();
    const second = show();
    expect(screen.getByText("CrissCross Daily 2026-11-28 · solved in 1 try https://cc-api.harkirat-hira.workers.dev/d/2026-11-28")).toBeTruthy();
    second.unmount();
    jest.setSystemTime(new Date("2026-11-29T00:00:01Z"));
    show();
    expect(screen.queryByText(/solved in/)).toBeNull();
  });

  it("counts a slip when it happens: slip, reload, solve says 2 tries", () => {
    const p = puzzleForDate(DATE);
    const first = show();
    drop(slip(p));
    first.unmount();
    show();
    solve(p);
    expect(screen.getByText("CrissCross Daily 2026-11-28 · solved in 2 tries https://cc-api.harkirat-hira.workers.dev/d/2026-11-28")).toBeTruthy();
  });

  it("switches to the new puzzle at 00:00 UTC without unmounting", () => {
    jest.useRealTimers();
    jest.useFakeTimers({ now: new Date(`${DATE}T23:59:59Z`) });
    const p = puzzleForDate(DATE);
    show();
    solve(p);
    expect(screen.getByText(/solved in 1 try/)).toBeTruthy();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText(/Daily puzzle · 2026-11-29/)).toBeTruthy();
    expect(screen.queryByText(/solved in/)).toBeNull();
    const next = puzzleForDate("2026-11-29");
    solve(next);
    expect(screen.getByText(/CrissCross Daily 2026-11-29 · solved in 1 try/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("cc.daily")).date).toBe("2026-11-29");
  });

  it("disables the columns once solved or slipped, and focus lands on Try again", () => {
    const p = puzzleForDate(DATE);
    show();
    drop(slip(p));
    expect(screen.getByRole("button", { name: /Drop piece in column 4$/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: /Drop piece in column 4$/ }).disabled).toBe(false);
    solve(p);
    expect(screen.getByRole("button", { name: /Drop piece in column 4$/ }).disabled).toBe(true);
  });

  it("falls back to a hand-copy field when the clipboard refuses", async () => {
    const p = puzzleForDate(DATE);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error("no")) } });
    show();
    solve(p);
    fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    expect((await screen.findByLabelText("Result line")).value).toMatch(/^CrissCross Daily 2026-11-28/);
  });
});

describe("share result", () => {
  const solved = () => { show(); solve(puzzleForDate(DATE)); };
  afterEach(() => { delete navigator.share; });

  it("shares text and a date-only link through navigator.share when there is one", async () => {
    navigator.share = jest.fn().mockResolvedValue();
    solved();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Share result" })); });
    expect(navigator.share).toHaveBeenCalledWith({ text: "CrissCross Daily 2026-11-28 · solved in 1 try", url: "https://cc-api.harkirat-hira.workers.dev/d/2026-11-28" });
  });

  it("copies text plus link and says Copied when there is no navigator.share", async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
    solved();
    fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CrissCross Daily 2026-11-28 · solved in 1 try\nhttps://cc-api.harkirat-hira.workers.dev/d/2026-11-28");
  });

  it("words the streak and the plural in the share text", () => {
    expect(shareText("2026-11-28", 5, 3)).toBe("CrissCross Daily 2026-11-28 · solved in 5 tries · 3 days in a row");
  });
});

describe("daily_link tally", () => {
  const beacon = jest.fn(() => true);
  const visit = (url) => render(<MemoryRouter initialEntries={[url]}><Daily /></MemoryRouter>);
  const hits = () => beacon.mock.calls.map(([u]) => u).filter((u) => u.includes("e=daily_link"));
  beforeEach(() => { beacon.mockClear(); Object.assign(navigator, { sendBeacon: beacon }); });

  it("counts one hit for an arrival with ?via=d and none without", () => {
    visit("/daily");
    expect(hits()).toHaveLength(0);
    visit("/daily?via=d");
    expect(hits()).toHaveLength(1);
  });

  it("drops ?via=d from the address once counted, so a reload or a bookmark does not count again", () => {
    const Where = () => <output data-testid="where">{useLocation().search}</output>;
    render(<MemoryRouter initialEntries={["/daily?via=d&x=1"]}><Daily /><Where /></MemoryRouter>);
    expect(hits()).toHaveLength(1);
    expect(screen.getByTestId("where").textContent).toBe("?x=1");
  });
});

describe("daily streak", () => {
  const seed = (rec) => window.localStorage.setItem("cc.daily", JSON.stringify(rec));
  const read = () => JSON.parse(window.localStorage.getItem("cc.daily"));

  it("counts consecutive solved days, from a record kept before streaks existed", () => {
    seed({ date: "2026-11-27", tries: 1, solved: true });
    show();
    solve(puzzleForDate(DATE));
    expect(screen.getByText("Day 2 in a row")).toBeTruthy();
    expect(screen.getByText("CrissCross Daily 2026-11-28 · solved in 1 try · 2 days in a row https://cc-api.harkirat-hira.workers.dev/d/2026-11-28")).toBeTruthy();
  });

  it("resets after a gap and leaves the day-1 result line unchanged", () => {
    seed({ date: "2026-11-25", tries: 1, solved: true, days: ["2026-11-24", "2026-11-25"] });
    show();
    solve(puzzleForDate(DATE));
    expect(screen.getByText("Day 1 in a row")).toBeTruthy();
    expect(screen.getByText("CrissCross Daily 2026-11-28 · solved in 1 try https://cc-api.harkirat-hira.workers.dev/d/2026-11-28")).toBeTruthy();
  });

  it("Try yesterday's loads yesterday's puzzle, keeps today's record, and a late solve extends the streak", () => {
    seed({ date: "2026-11-26", tries: 1, solved: true });
    show();
    solve(puzzleForDate(DATE));
    expect(screen.getByText("Day 1 in a row")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try yesterday's" }));
    expect(screen.getByText(/Daily puzzle · 2026-11-27/)).toBeTruthy();
    solve(puzzleForDate("2026-11-27"));
    expect(read()).toMatchObject({ date: DATE, tries: 1, solved: true });
    fireEvent.click(screen.getByRole("button", { name: "Back to today's" }));
    expect(screen.getByText("Day 3 in a row")).toBeTruthy();
  });

  it("offers Try yesterday's after a slip too", () => {
    show();
    drop(slip(puzzleForDate(DATE)));
    expect(screen.getByRole("button", { name: "Try yesterday's" })).toBeTruthy();
  });

  const YDAY = "2026-11-27";
  const toYesterday = () => fireEvent.click(screen.getByRole("button", { name: "Try yesterday's" }));

  it("yesterday's puzzle always offers Back to today's and says it is yesterday's, before finishing", () => {
    show();
    solve(puzzleForDate(DATE));
    toYesterday();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/yesterday's/i);
    fireEvent.click(screen.getByRole("button", { name: "Back to today's" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/yesterday's/i);
    expect(screen.getByText(/solved in 1 try/)).toBeTruthy();
  });

  it("replaying a day already solved shows no new result line and keeps the streak", () => {
    seed({ date: YDAY, tries: 1, solved: true, days: [YDAY] });
    show();
    drop(slip(puzzleForDate(DATE)));
    toYesterday();
    expect(screen.getByText("Already solved.")).toBeTruthy();
    expect(screen.queryByText(/solved in/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Share result" })).toBeNull();
    expect(read().days).toEqual([YDAY]);
  });

  it("a slip on yesterday's puzzle leaves today's record untouched", () => {
    show();
    solve(puzzleForDate(DATE));
    toYesterday();
    drop(slip(puzzleForDate(YDAY)));
    expect(read()).toMatchObject({ date: DATE, tries: 1, solved: true, days: [DATE] });
  });

  it("keeps the days of a record with no date", () => {
    seed({ days: [YDAY] });
    show();
    solve(puzzleForDate(DATE));
    expect(screen.getByText("Day 2 in a row")).toBeTruthy();
  });

  it("ignores garbage in days, drops future dates and keeps only the latest 400", () => {
    const old = Array.from({ length: 450 }, (_, i) => new Date(Date.parse("2025-01-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10));
    seed({ date: YDAY, tries: 1, solved: true, days: ["junk", 5, null, {}, "2026-11-2", "2026-12-01", "2027-01-01", YDAY, YDAY, ...old] });
    show();
    solve(puzzleForDate(DATE));
    expect(screen.getByText("Day 2 in a row")).toBeTruthy();
    const days = read().days;
    expect(days).toHaveLength(400);
    expect(new Set(days).size).toBe(400);
    expect(days).toContain(DATE);
    expect(days).not.toContain("2026-12-01");
    expect(days).not.toContain("junk");
    expect(days).not.toContain(old[0]);
  });
});

describe("dated daily link /daily/:date", () => {
  const seed = (rec) => window.localStorage.setItem("cc.daily", JSON.stringify(rec));
  const read = () => JSON.parse(window.localStorage.getItem("cc.daily"));
  const at = (url) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/daily" element={<Daily />} /><Route path="/daily/:date" element={<Daily />} /></Routes>
    </MemoryRouter>,
  );
  const PAST = "2026-11-27";

  it("opens that date's puzzle", () => {
    at(`/daily/${PAST}`);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Daily puzzle · 2026-11-27/);
    expect(screen.queryByText(/isn't available/)).toBeNull();
  });

  it("shows today's puzzle with a note for a date that is out of range or not a date", () => {
    for (const d of ["2026-11-26", "2026-11-29", "2026-02-30", "nope"]) {
      const v = at(`/daily/${d}`);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Daily puzzle · 2026-11-28/);
      expect(screen.getByText("That puzzle isn't available, here is today's.")).toBeTruthy();
      v.unmount();
    }
  });

  it("keeps tries on a past date when switching days: slip, go to today, come back, solve counts both", () => {
    at(`/daily/${PAST}`);
    drop(slip(puzzleForDate(PAST)));
    fireEvent.click(screen.getByRole("button", { name: "Back to today's" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/2026-11-28/);
    solve(puzzleForDate(DATE));
    fireEvent.click(screen.getByRole("button", { name: "Try yesterday's" }));
    solve(puzzleForDate(PAST));
    expect(screen.getByText(/CrissCross Daily 2026-11-27 · solved in 2 tries/)).toBeTruthy();
  });

  it("solving a past date leaves today's record and streak untouched", () => {
    seed({ date: DATE, tries: 3, solved: true, days: [DATE] });
    at(`/daily/${PAST}`);
    solve(puzzleForDate(PAST));
    expect(read()).toMatchObject({ date: DATE, tries: 3, solved: true });
    expect(read().days).toEqual([PAST, DATE]);
  });

  it("still counts and strips ?via=d", () => {
    const beacon = jest.fn(() => true);
    Object.assign(navigator, { sendBeacon: beacon });
    const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().search}</output>;
    render(<MemoryRouter initialEntries={[`/daily/${PAST}?via=d`]}><Daily /><Where /></MemoryRouter>);
    expect(beacon.mock.calls.filter(([u]) => u.includes("e=daily_link"))).toHaveLength(1);
    expect(screen.getByTestId("where").textContent).toBe(`/daily/${PAST}`);
  });
});

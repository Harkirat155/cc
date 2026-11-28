import React from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Daily, { shareText } from "./Daily";
import { puzzleForDate, keepsWin, defenderReply, solutionLine, tttPuzzleForDate } from "@shared/daily.js";
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

// Reads the board back from the rendered column labels ("Column 3: red, yellow, 2 empty").
const boardOnScreen = () => {
  const board = Array(42).fill("");
  COLS.forEach((c) => {
    const label = screen.getByRole("button", { name: new RegExp(`^Column ${c + 1}:`) }).getAttribute("aria-label");
    const discs = label.replace(/^Column \d+: /, "").split(". ")[0].split(", ").filter((w) => w === "red" || w === "yellow");
    discs.forEach((w, i) => { board[(5 - i) * 7 + c] = w === "red" ? "R" : "Y"; });
  });
  return board;
};

describe("show the solution", () => {
  const slipped = () => {
    const p = puzzleForDate(DATE);
    show();
    drop(slip(p));
    return p;
  };

  it("is not offered while the puzzle is still in play", () => {
    show();
    expect(screen.queryByRole("button", { name: "Show the solution" })).toBeNull();
  });

  it("after a slip, steps a winning line one move per press and ends in a win within n of the player's moves", () => {
    const p = slipped();
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    expect(boardOnScreen()).toEqual(p.board);
    expect(screen.getByRole("button", { name: /Drop piece in column 4$/ }).disabled).toBe(true);
    let presses = 0;
    let before = boardOnScreen().filter(Boolean).length;
    while (screen.queryByRole("button", { name: "Next move" }) && !screen.getByRole("button", { name: "Next move" }).disabled) {
      fireEvent.click(screen.getByRole("button", { name: "Next move" }));
      presses++;
      const now = boardOnScreen().filter(Boolean).length;
      expect(now).toBe(before + 1);
      before = now;
      expect(presses).toBeLessThan(10);
    }
    const end = boardOnScreen();
    const result = connect4.checkTerminal({ board: end });
    expect(result.status).toBe("win");
    expect(end.filter(Boolean).length - p.board.filter(Boolean).length).toBeLessThanOrEqual(2 * p.n - 1);
    const mark = ["R", "Y"][p.turn];
    expect(end.filter((v, i) => v && v !== p.board[i] && v === mark).length).toBeLessThanOrEqual(p.n);
  });

  it("announces each shown move once and leaves the record untouched; Back restores the player's board", () => {
    const p = slipped();
    const record = window.localStorage.getItem("cc.daily");
    const mine = boardOnScreen();
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(screen.getAllByText(/dropped in column \d$/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to my board" }));
    expect(boardOnScreen()).toEqual(mine);
    expect(screen.getByText("That lets them off the hook")).toBeTruthy();
    expect(window.localStorage.getItem("cc.daily")).toBe(record);
    expect(p).toBeTruthy();
  });

  const stepToEnd = () => {
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    while (!screen.getByRole("button", { name: "Next move" }).disabled) fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  };
  // Cells ringed as winning, read from the rendered discs (row-major index), per column button top to bottom.
  const ringed = () => COLS.flatMap((c) => {
    const btn = screen.getByRole("button", { name: new RegExp(`^Column ${c + 1}:`) });
    return [...btn.children].map((el, r) => (el.className.includes("ring-4") ? r * 7 + c : -1)).filter((i) => i >= 0);
  }).sort((a, b) => a - b);

  it("on the last move rings exactly the winning four, and not before", () => {
    slipped();
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(ringed()).toEqual([]);
    while (!screen.getByRole("button", { name: "Next move" }).disabled) fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    const win = connect4.checkTerminal({ board: boardOnScreen() });
    expect(win.status).toBe("win");
    expect(ringed()).toEqual([...win.line].sort((a, b) => a - b));
    expect(ringed()).toHaveLength(4);
  });

  it("captions the solution as move k of N, then who wins, and Back restores the outcome text", () => {
    const p = slipped();
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    const total = solutionLine(p).length;
    const caption = () => screen.getAllByRole("status").map((e) => e.textContent).join("|");
    expect(screen.queryByText("That lets them off the hook")).toBeNull();
    expect(caption()).toContain(`Solution · ${total} moves, press Next move`);
    expect(caption()).not.toContain("move 0");
    fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(caption()).toContain(`Solution · move 1 of ${total}`);
    while (!screen.getByRole("button", { name: "Next move" }).disabled) fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(caption()).toContain(`Solution · ${["Red", "Yellow"][p.turn]} wins`);
    expect(caption()).not.toContain("of " + total);
    fireEvent.click(screen.getByRole("button", { name: "Back to my board" }));
    expect(screen.getByText("That lets them off the hook")).toBeTruthy();
    expect(caption()).not.toContain("Solution");
  });

  it("is offered after a solve and keeps the share line", () => {
    const p = puzzleForDate(DATE);
    show();
    solve(p);
    const record = window.localStorage.getItem("cc.daily");
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to my board" }));
    expect(window.localStorage.getItem("cc.daily")).toBe(record);
    expect(screen.getByText(/solved in 1 try/)).toBeTruthy();
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

describe("play someone now", () => {
  const beacon = jest.fn(() => true);
  const link = () => screen.queryByRole("link", { name: "Play someone now" });
  const events = (e) => beacon.mock.calls.map(([u]) => u).filter((u) => u.includes(`e=${e}`));
  const live = (open) => { window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [], open }) }); };
  const solvedDay = async () => { show(); solve(puzzleForDate(DATE)); await act(async () => {}); };
  beforeEach(() => { beacon.mockClear(); Object.assign(navigator, { sendBeacon: beacon }); live([]); });

  it("appears once the day is done, not before, and hides in the solution view", async () => {
    show();
    expect(link()).toBeNull();
    solve(puzzleForDate(DATE));
    await act(async () => {});
    expect(link()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    expect(link()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to my board" }));
    expect(link()).toBeTruthy();
  });

  it("appears after a slip too", async () => {
    show();
    drop(slip(puzzleForDate(DATE)));
    await act(async () => {});
    expect(link()).toBeTruthy();
  });

  it("points at an open Connect Four seat", async () => {
    live([{ roomId: "TT111", gameId: "tictactoe", name: "Cy" }, { roomId: "AB234", gameId: "connect4", name: "Ada" }]);
    await solvedDay();
    expect(link().getAttribute("href")).toBe("/room/AB234");
  });

  it("points at the lobby with no open seat", async () => {
    live([{ roomId: "TT111", gameId: "tictactoe", name: "Cy" }]);
    await solvedDay();
    expect(link().getAttribute("href")).toBe("/lobby");
  });

  it("points at the lobby when the fetch fails", async () => {
    window.fetch = jest.fn().mockRejectedValue(new Error("offline"));
    await solvedDay();
    expect(link().getAttribute("href")).toBe("/lobby");
  });

  it("sends daily_play on click", async () => {
    await solvedDay();
    expect(events("daily_play")).toHaveLength(0);
    fireEvent.click(link());
    expect(events("daily_play")).toHaveLength(1);
  });

  it("sends daily_solve once on first solve and not when a solved day is shown again", async () => {
    await solvedDay();
    expect(events("daily_solve")).toHaveLength(1);
    render(<MemoryRouter><Daily /></MemoryRouter>);
    expect(screen.getAllByText("Solved.").length).toBeGreaterThan(1);
    expect(events("daily_solve")).toHaveLength(1);
  });
});

describe("a Tic-Tac-Toe day", () => {
  const TTT_DATE = "2026-11-30"; // gameForDate: every fourth UTC day
  const beacon = jest.fn(() => true);
  const events = (e) => beacon.mock.calls.map(([u]) => u).filter((u) => new window.URL(u).searchParams.get("e") === e);
  const cell = (i) => screen.getByRole("button", { name: new RegExp(`^Square row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1} `) });
  const wrong = (p) => p.board.findIndex((v, i) => v === "" && !p.answers.includes(i));
  const p = tttPuzzleForDate(TTT_DATE);
  beforeEach(() => {
    jest.setSystemTime(new Date(`${TTT_DATE}T10:00:00Z`));
    beacon.mockClear();
    Object.assign(navigator, { sendBeacon: beacon });
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [], open: [] }) });
  });

  it("names the game and the task, with every cell a labelled button", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Tic-Tac-Toe");
    expect(screen.getByText(new RegExp(`^${["X", "O"][p.turn]} to move: ${p.kind === "win" ? "win now" : "block their win"}`))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Square row \d, column \d /})).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /Drop piece/ })).toBeNull();
  });

  it("the right cell solves it: result line names the game, tallies daily_solve_ttt only", async () => {
    show();
    fireEvent.click(cell(p.answers[0]));
    expect(screen.getByText("Solved.")).toBeTruthy();
    expect(screen.getByText(`CrissCross Daily ${TTT_DATE} · Tic-Tac-Toe · solved in 1 try https://cc-api.harkirat-hira.workers.dev/d/${TTT_DATE}`)).toBeTruthy();
    expect(events("daily_solve_ttt")).toHaveLength(1);
    expect(events("daily_solve")).toHaveLength(0);
  });

  it("a wrong cell is a counted try; Try again resets the board", () => {
    show();
    fireEvent.click(cell(wrong(p)));
    expect(screen.getByText("That lets them off the hook")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(cell(p.answers[0]));
    expect(screen.getByText(new RegExp(`solved in 2 tries`))).toBeTruthy();
  });

  it("shows the solution as one move, then the winner when it wins", () => {
    show();
    fireEvent.click(cell(wrong(p)));
    fireEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(screen.getByText(/^Solution ·/).textContent).toMatch(p.kind === "win" ? /wins$/ : /move 1 of 1$/);
  });

  it("Play someone now joins an open Tic-Tac-Toe seat, not a Connect Four one", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [], open: [{ roomId: "CF111", gameId: "connect4", name: "Cy" }, { roomId: "TT222", gameId: "ttt", name: "Ada" }] }) });
    show();
    fireEvent.click(cell(p.answers[0]));
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Play someone now" }).getAttribute("href")).toBe("/room/TT222");
    fireEvent.click(screen.getByRole("link", { name: "Play someone now" }));
    expect(events("daily_play_ttt")).toHaveLength(1);
    expect(events("daily_play")).toHaveLength(0);
  });

  it("counts a shared-link arrival as daily_link_ttt", () => {
    render(<MemoryRouter initialEntries={[`/daily/${TTT_DATE}?via=d`]}><Routes><Route path="/daily/:date" element={<Daily />} /></Routes></MemoryRouter>);
    expect(events("daily_link_ttt")).toHaveLength(1);
    expect(events("daily_link")).toHaveLength(0);
  });
});

import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import checkers from "@shared/games/checkers.js";
import Replay, { rebuild } from "./Replay";

const body = { id: "r1", gameId: "ttt", players: ["Ada Bot", "House (easy)"], first: 0, result: "X", at: 1, moves: [{ type: "place", cell: 4 }, { type: "place", cell: 0 }, { type: "place", cell: 8 }, { type: "place", cell: 1 }, { type: "place", cell: 6 }] };
const show = () => render(<MemoryRouter initialEntries={["/replay/r1"]}><Routes><Route path="/replay/:id" element={<Replay />} /></Routes></MemoryRouter>);
const stub = (res) => { window.fetch = jest.fn(async () => res); };
afterEach(() => { delete window.fetch; });

describe("rebuild", () => {
  it("replays the moves from the stored first seat, one position per move", () => {
    const ps = rebuild("ttt", 1, [{ type: "place", cell: 4 }, { type: "place", cell: 0 }]);
    expect(ps).toHaveLength(3);
    expect(ps[1].board[4]).toBe("O");
    expect(ps[2].board[0]).toBe("X");
  });
  it("throws on a move the rules refuse", () => {
    expect(() => rebuild("ttt", 0, [{ type: "place", cell: 4 }, { type: "place", cell: 4 }])).toThrow();
  });
});

describe("rebuild, other games", () => {
  it("replays a Checkers capture", () => {
    // find a real capture by playing legal moves from the start until a jump exists
    const rules = checkers;
    let st = rules.createInitialState();
    const moves = [];
    for (let i = 0; i < 40 && !moves.some((m) => m.captures?.length); i++) {
      const legal = rules.getLegalMoves(st, st.turn);
      const pick = legal.find((m) => m.captures?.length) || legal[0];
      moves.push({ type: "transfer", from: pick.from, to: pick.to, captures: pick.captures || [] });
      st = rules.applyMove(st, moves[moves.length - 1], st.turn).state;
    }
    expect(moves.some((m) => m.captures.length)).toBe(true);
    const ps = rebuild("checkers", 0, moves);
    expect(ps).toHaveLength(moves.length + 1);
    expect(ps[ps.length - 1].board).toEqual(st.board);
  });
  it("replays a Connect Four game to a win", () => {
    const cols = [3, 4, 3, 4, 3, 4, 3].map((c) => ({ type: "place", cell: c }));
    const ps = rebuild("connect4", 0, cols);
    expect(ps[7].status).toBe("win");
    expect(ps[7].winner).toBe(0);
  });
});

describe("replay page", () => {
  it("renders no enabled board cell in Tic-Tac-Toe or Five in a Row", async () => {
    stub({ ok: true, json: async () => ({ ...body, moves: body.moves.slice(0, 3) }) });
    const { unmount } = show();
    await screen.findByText("Move 0 of 3");
    const cells = () => screen.getAllByRole("button").filter((b) => !["Previous", "Next", "Copy link"].includes(b.textContent));
    expect(cells().length).toBeGreaterThan(8);
    expect(cells().every((b) => b.disabled)).toBe(true);
    unmount();
    stub({ ok: true, json: async () => ({ ...body, gameId: "five", moves: [{ type: "place", cell: 112 }, { type: "place", cell: 0 }] }) });
    show();
    await screen.findByText("Move 0 of 2");
    expect(cells().length).toBeGreaterThan(200);
    expect(cells().every((b) => b.disabled)).toBe(true);
  });

  it("steps with the arrow keys", async () => {
    stub({ ok: true, json: async () => ({ ...body, moves: body.moves.slice(0, 3) }) });
    show();
    await screen.findByText("Move 0 of 3");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Move 2 of 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Move 1 of 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Move 0 of 3")).toBeTruthy();
  });

  it("steps Previous and Next with a move counter, and stops at both ends", async () => {
    stub({ ok: true, json: async () => ({ ...body, moves: body.moves.slice(0, 3) }) });
    show();
    expect(await screen.findByText("Move 0 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Move 1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Move 3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Move 2 of 3")).toBeTruthy();
    expect(window.fetch.mock.calls[0][0]).toMatch(/\/api\/replay\/r1$/);
  });

  it("names the players and the result", async () => {
    stub({ ok: true, json: async () => ({ ...body, moves: body.moves.slice(0, 3) }) });
    show();
    expect(await screen.findByText(/Ada Bot \(X\) vs House \(easy\) \(O\)/)).toBeTruthy();
    expect(screen.getByText(/Tic-Tac-Toe · Ada Bot won/)).toBeTruthy();
  });

  it("says plainly when the replay does not exist", async () => {
    stub({ ok: false, status: 404 });
    show();
    expect(await screen.findByText(/No replay with this link/)).toBeTruthy();
  });

  it("says so, with a retry, when it cannot load, and recovers", async () => {
    stub({ ok: false, status: 500 });
    show();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load this replay/);
    stub({ ok: true, json: async () => body });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Move 0 of 5")).toBeTruthy();
  });

  it("says so when the stored moves do not replay", async () => {
    stub({ ok: true, json: async () => ({ ...body, moves: [{ type: "place", cell: 4 }, { type: "place", cell: 4 }] }) });
    show();
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be replayed/);
  });

  it("copies the unfurling /r/{id} link from the Worker, not the Pages URL", async () => {
    stub({ ok: true, json: async () => body });
    const writeText = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("https://cc-api.harkirat-hira.workers.dev/r/r1");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});

describe("arrivals from a shared /r/ link", () => {
  const visit = (path, strict = false) => {
    const ui = <MemoryRouter initialEntries={[path]}><Routes><Route path="/replay/:id" element={<Replay />} /></Routes></MemoryRouter>;
    return render(strict ? <React.StrictMode>{ui}</React.StrictMode> : ui);
  };
  const hits = () => beacon.mock.calls.map(([u]) => u).filter((u) => u.includes("e=replay_link"));
  let beacon;
  beforeEach(() => {
    beacon = jest.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", { value: beacon, configurable: true });
  });

  it("counts one replay_link hit once the replay has loaded through /r/", async () => {
    stub({ ok: true, json: async () => body });
    visit("/replay/r1?via=r");
    expect(hits()).toHaveLength(0);
    await screen.findByText("Move 0 of 5");
    expect(hits()).toHaveLength(1);
    expect(hits()[0]).toContain("p=cc");
  });

  it("counts once under StrictMode double effects", async () => {
    stub({ ok: true, json: async () => body });
    visit("/replay/r1?via=r", true);
    await screen.findByText("Move 0 of 5");
    expect(hits()).toHaveLength(1);
  });

  it("counts nothing when the page is opened directly", async () => {
    stub({ ok: true, json: async () => body });
    visit("/replay/r1");
    await screen.findByText("Move 0 of 5");
    expect(hits()).toHaveLength(0);
  });

  it("counts nothing on a 404, a 500 or moves that do not replay", async () => {
    stub({ ok: false, status: 404 });
    let u = visit("/replay/r1?via=r");
    await screen.findByText(/No replay with this link/);
    u.unmount();
    stub({ ok: false, status: 500 });
    u = visit("/replay/r1?via=r");
    await screen.findByText(/Could not load/);
    u.unmount();
    stub({ ok: true, json: async () => ({ ...body, moves: [{ type: "place", cell: 4 }, { type: "place", cell: 4 }] }) });
    visit("/replay/r1?via=r");
    await screen.findByText(/could not be replayed/);
    expect(hits()).toHaveLength(0);
  });
});

describe("copy link", () => {
  afterEach(() => { delete navigator.clipboard; jest.useRealTimers(); });
  it("announces Copied in a polite status", async () => {
    stub({ ok: true, json: async () => body });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    await screen.findByRole("button", { name: "Copied" });
    const live = screen.getAllByRole("status").find((e) => e.textContent === "Copied");
    expect(live.getAttribute("aria-live")).toBe("polite");
  });
  it("shows the link as selectable text when the clipboard refuses or is missing", async () => {
    stub({ ok: true, json: async () => body });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("no")) } });
    const u = show();
    fireEvent.click(await screen.findByRole("button", { name: /Copy link|Copy failed/ }));
    const box = await screen.findByLabelText(/Replay link/);
    expect(box.value).toBe("https://cc-api.harkirat-hira.workers.dev/r/r1");
    expect(box.readOnly).toBe(true);
    u.unmount();
    delete navigator.clipboard;
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Copy link|Copy failed/ }));
    expect((await screen.findByLabelText(/Replay link/)).value).toMatch(/\/r\/r1$/);
  });
  it("clears the previous timer before setting a new one", async () => {
    stub({ ok: true, json: async () => body });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
    show();
    const b = await screen.findByRole("button", { name: "Copy link" });
    const spy = jest.spyOn(window, "clearTimeout");
    fireEvent.click(b);
    await screen.findByRole("button", { name: "Copied" });
    const before = spy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Copied" }));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before));
    spy.mockRestore();
  });
});

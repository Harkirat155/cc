import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Live from "./Live";
import Rush from "./Rush";
import HomeDoors from "./components/HomeDoors";
import Arena from "./Arena";
import Lobby from "./Lobby";
import Game from "./Game";
import { Routes, Route, useLocation } from "react-router-dom";
import { AppTooltipProvider } from "./components/ui/Tooltip";
import { act, fireEvent, within } from "@testing-library/react";

let mockLobby = false; // the Lobby test swaps the socket hook for a disconnected stub; Game uses the real one
jest.mock("./hooks/useSocketGame", () => {
  const actual = jest.requireActual("./hooks/useSocketGame");
  return {
    __esModule: true,
    default: (...args) => (mockLobby
      ? { gameState: { gameId: "ttt" }, lobbyQueue: [], isInLobby: false, joinLobby: () => Promise.resolve(), leaveLobby: () => Promise.resolve(), socketId: null, roomId: null, displayName: "Me", connectionState: "disconnected" }
      : actual.default(...args)),
  };
});
window.React = React;

const setOnLine = (v) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });
const NO_SIGNAL = /No signal: play the computer or a friend on this phone\./;

beforeEach(() => { window.fetch = jest.fn().mockRejectedValue(new Error("offline")); });
afterEach(() => { mockLobby = false; setOnLine(true); delete window.fetch; });

describe("offline surfaces", () => {
  it("Live says no signal and offers the computer game, with no fake list", async () => {
    setOnLine(false);
    render(<MemoryRouter><Live /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(NO_SIGNAL);
    expect(screen.getByRole("button", { name: "Play the computer" })).toBeTruthy();
    expect(screen.queryByText(/No listed games/)).toBeNull();
  });

  it("Live keeps its honest error, not No signal, when the request fails while online", async () => {
    render(<MemoryRouter><Live /></MemoryRouter>);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Could not load the list/);
    expect(alert.textContent).not.toMatch(/No signal/);
  });

  it("Live going offline after a good load keeps the list and shows No signal without Could not load", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ roomId: "K7P2M", gameId: "connect4", players: ["Ada", "Bo"], moves: 1, startedAt: Date.now() }] }) });
    render(<MemoryRouter><Live /></MemoryRouter>);
    expect(await screen.findByText("Ada vs Bo")).toBeTruthy();
    setOnLine(false);
    act(() => { window.dispatchEvent(new window.Event("offline")); });
    expect(screen.getByRole("alert").textContent).toMatch(NO_SIGNAL);
    expect(screen.getByRole("alert").textContent).not.toMatch(/Could not load/);
    expect(screen.getByText("Ada vs Bo")).toBeTruthy();
  });

  it("Arena says no signal offline and a plain error when online", async () => {
    setOnLine(false);
    const { unmount } = render(<MemoryRouter><Arena /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(NO_SIGNAL);
    unmount();
    setOnLine(true);
    render(<MemoryRouter><Arena /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load the leaderboard/);
  });

  it("Lobby says no signal offline", () => {
    mockLobby = true;
    setOnLine(false);
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toMatch(NO_SIGNAL);
  });

  it("a room link offline: the button starts the computer game in Game's own state", () => {
    setOnLine(false);
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    window.scrollTo = jest.fn();
    window.localStorage.clear();
    const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
    render(
      <AppTooltipProvider><MemoryRouter initialEntries={["/room/ABCDE"]}>
        <Routes><Route path="/" element={<Game />} /><Route path="/room/:roomId" element={<Game />} /></Routes>
        <Where />
      </MemoryRouter></AppTooltipProvider>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(NO_SIGNAL);
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Play the computer" }));
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.getByRole("button", { name: "Computer" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Rush says the server-checked best is missing, and still plays", async () => {
    setOnLine(false);
    render(<MemoryRouter initialEntries={["/rush"]}><Rush /></MemoryRouter>);
    expect(await screen.findByText(/No signal: today's best is checked by the server/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /start/i })).toBeTruthy();
  });

  it("the home door that makes an online room says it needs a signal", () => {
    setOnLine(false);
    render(<MemoryRouter><HomeDoors onComputer={() => {}} onFriend={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Needs a signal")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Play a friend/ }).disabled).toBe(true);
    expect(screen.getByText("Easy to hard")).toBeTruthy();
  });
});

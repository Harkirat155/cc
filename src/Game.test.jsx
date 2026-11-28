import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Game from "./Game";
import { AppTooltipProvider } from "./components/ui/Tooltip";

// HistoryPanel relies on the bundler's automatic JSX runtime; Jest uses the classic one.
window.React = React;

const home = () =>
  render(
    <AppTooltipProvider><MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/daily" element={<p>daily page</p>} />
        <Route path="/rush" element={<p>rush page</p>} />
      </Routes>
    </MemoryRouter></AppTooltipProvider>
  );
const beacons = () =>
  window.navigator.sendBeacon.mock.calls.map(([u]) => new window.URL(u).searchParams.get("e"));

beforeEach(() => {
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.scrollTo = jest.fn();
  window.localStorage.clear();
  window.navigator.sendBeacon = jest.fn(() => true);
});

describe("home doors", () => {
  it("offers today's puzzle, Rush, the computer and a friend, and counts each tap", () => {
    home();
    const doors = screen.getByRole("navigation", { name: "Ways to play" });
    expect(doors.textContent).toMatch(/Today.s puzzle/);
    expect(doors.textContent).toMatch(/Puzzle Rush/);
    expect(doors.textContent).toMatch(/Play the computer/);
    expect(doors.textContent).toMatch(/Play a friend/);

    fireEvent.click(screen.getByRole("button", { name: /Play the computer/ }));
    expect(beacons()).toContain("door_computer");
    expect(screen.getByRole("button", { name: "Computer" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("link", { name: /Puzzle Rush/ }));
    expect(beacons()).toContain("door_rush");
    expect(screen.getByText("rush page")).toBeTruthy();
  });

  it("opens the daily from its door", () => {
    home();
    fireEvent.click(screen.getByRole("link", { name: /Today.s puzzle/ }));
    expect(beacons()).toContain("door_daily");
    expect(screen.getByText("daily page")).toBeTruthy();
  });
});

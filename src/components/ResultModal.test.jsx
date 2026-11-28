/**
 * @jest-environment-options {"url": "https://harkirat155.github.io/cc/"}
 */
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultModal from "./ResultModal";
import { AppTooltipProvider } from "./ui/Tooltip";

const open = () =>
  render(
    <AppTooltipProvider>
      <MemoryRouter initialEntries={["/room/ABCD"]}>
        <Routes>
          <Route path="/room/ABCD" element={<ResultModal result="X Wins!" player="X" roster={{ O: "s2", OName: "Bo" }} socketId="s1" />} />
          <Route path="/daily" element={<p>daily page</p>} />
        </Routes>
      </MemoryRouter>
    </AppTooltipProvider>
  );

beforeEach(() => {
  window.localStorage.clear();
  window.navigator.sendBeacon = jest.fn(() => true);
});

it("points a finished online game at today's puzzle, never at a second friend room", () => {
  open();
  expect(screen.getByRole("button", { name: "Request rematch" })).toBeTruthy();
  expect(screen.queryByText(/Play a friend/)).toBeNull();

  fireEvent.click(screen.getByRole("link", { name: /Try today.s puzzle/ }));
  const events = window.navigator.sendBeacon.mock.calls.map(([u]) => new window.URL(u).searchParams.get("e"));
  expect(events).toEqual(["end_daily"]);
  expect(screen.getByText("daily page")).toBeTruthy();
});

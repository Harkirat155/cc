/**
 * @jest-environment-options {"url": "https://harkirat155.github.io/cc/"}
 */
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import WinnerCard from "./WinnerCard";

window.matchMedia = jest.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));

const show = (props) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<WinnerCard winner="X" gameId="ttt" onReset={() => {}} {...props} />} />
        <Route path="/daily" element={<p>daily page</p>} />
      </Routes>
    </MemoryRouter>
  );
const beacons = () =>
  window.navigator.sendBeacon.mock.calls.map(([u]) => new window.URL(u).searchParams.get("e"));

beforeEach(() => {
  window.localStorage.clear();
  window.navigator.sendBeacon = jest.fn(() => true);
});

it("leads a finished local game to today's puzzle and a friend, beside the rematch", () => {
  const onFriend = jest.fn();
  show({ onFriend });
  expect(screen.getByRole("button", { name: "Start new game" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Play a friend/ }));
  expect(onFriend).toHaveBeenCalledTimes(1);
  expect(beacons()).toEqual(["end_friend"]);

  fireEvent.click(screen.getByRole("link", { name: /Try today.s puzzle/ }));
  expect(beacons()).toContain("end_daily");
  expect(screen.getByText("daily page")).toBeTruthy();
});

it("offers no friend door when there is no handler, and nothing before a result", () => {
  const { unmount } = show({});
  expect(screen.queryByRole("button", { name: /Play a friend/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Try today.s puzzle/ })).toBeTruthy();
  unmount();
  show({ winner: null, onFriend: () => {} });
  expect(screen.queryByRole("link", { name: /Try today.s puzzle/ })).toBeNull();
});

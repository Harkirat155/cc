import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Live from "./Live";
import Rush from "./Rush";
import HomeDoors from "./components/HomeDoors";

const setOnLine = (v) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });
const NO_SIGNAL = /No signal: play the computer or a friend on this phone\./;

beforeEach(() => { window.fetch = jest.fn().mockRejectedValue(new Error("offline")); });
afterEach(() => { setOnLine(true); delete window.fetch; });

describe("offline surfaces", () => {
  it("Live says no signal and offers the computer game, with no fake list", async () => {
    setOnLine(false);
    render(<MemoryRouter><Live /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(NO_SIGNAL);
    expect(screen.getByRole("button", { name: "Play the computer" })).toBeTruthy();
    expect(screen.queryByText(/No listed games/)).toBeNull();
  });

  it("Live says the same when the request fails while the phone thinks it is online", async () => {
    render(<MemoryRouter><Live /></MemoryRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(NO_SIGNAL);
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
    expect(screen.getByText("Easy to hard")).toBeTruthy();
  });
});

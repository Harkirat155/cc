import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import NoSignal from "./NoSignal";
import useOnline from "../hooks/useOnline";

const Probe = () => (useOnline() ? <p>online</p> : <p>offline</p>);
const setOnLine = (v) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });

afterEach(() => { setOnLine(true); window.localStorage.clear(); });

describe("useOnline", () => {
  it("follows navigator.onLine and the online/offline events", () => {
    setOnLine(false);
    render(<Probe />);
    expect(screen.getByText("offline")).toBeTruthy();
    setOnLine(true);
    act(() => { window.dispatchEvent(new window.Event("online")); });
    expect(screen.getByText("online")).toBeTruthy();
    act(() => { window.dispatchEvent(new window.Event("offline")); });
    expect(screen.getByText("offline")).toBeTruthy();
  });
});

describe("NoSignal", () => {
  it("says it plainly and the button opens the computer game", () => {
    render(
      <MemoryRouter initialEntries={["/live"]}>
        <Routes>
          <Route path="/live" element={<NoSignal>Could not load.</NoSignal>} />
          <Route path="/" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Could not load. No signal: play the computer or a friend on this phone.Play the computer");
    fireEvent.click(screen.getByRole("button", { name: "Play the computer" }));
    expect(screen.getByText("home")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("cc.opponent")).mode).toBe("computer");
  });
});

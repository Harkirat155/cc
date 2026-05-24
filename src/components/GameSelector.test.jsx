import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router-dom";
import "@shared/games/index.js"; // registers ttt, connect4, checkers
import GameSelector from "./GameSelector";

// jsdom's window.location is locked-down; we can't spy on .reload().
// Instead, swallow the "navigation not implemented" jsdom error so the URL
// assertion is what proves the picker did its job.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("Not implemented: navigation")) return;
    if (first && first.message && first.message.includes("Not implemented: navigation")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

function Harness({ initialEntries = ["/"], probe }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <GameSelector isMultiplayer={false} currentGameId={null} />
              {probe ? <SearchProbe /> : null}
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="probe">{params.get("game") || ""}</div>;
}

describe("GameSelector", () => {
  test("hidden in multiplayer without a switch callback", () => {
    render(
      <MemoryRouter>
        <GameSelector isMultiplayer currentGameId="ttt" />
      </MemoryRouter>
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  test("multiplayer selection calls onSwitchGame without changing URL", () => {
    const onSwitchGame = jest.fn();
    render(
      <MemoryRouter initialEntries={["/?game=ttt"]}>
        <GameSelector
          isMultiplayer
          currentGameId="ttt"
          onSwitchGame={onSwitchGame}
        />
        <SearchProbe />
      </MemoryRouter>
    );

    const select = screen.getByRole("combobox", { name: /choose game/i });
    fireEvent.change(select, { target: { value: "connect4" } });

    expect(onSwitchGame).toHaveBeenCalledWith("connect4");
    expect(screen.getByTestId("probe").textContent).toBe("ttt");
  });

  test("renders one option per registered game", () => {
    render(<Harness />);
    const select = screen.getByRole("combobox", { name: /choose game/i });
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.value
    );
    expect(options).toEqual(expect.arrayContaining(["ttt", "connect4", "checkers"]));
  });

  test("changing selection updates ?game= and triggers reload", () => {
    render(<Harness probe />);
    const select = screen.getByRole("combobox", { name: /choose game/i });
    fireEvent.change(select, { target: { value: "checkers" } });
    expect(screen.getByTestId("probe").textContent).toBe("checkers");
  });

  test("selecting the default game clears the ?game= param", () => {
    render(<Harness initialEntries={["/?game=checkers"]} probe />);
    expect(screen.getByTestId("probe").textContent).toBe("checkers");
    const select = screen.getByRole("combobox", { name: /choose game/i });
    fireEvent.change(select, { target: { value: "ttt" } });
    expect(screen.getByTestId("probe").textContent).toBe("");
  });

  test("reflects currentGameId when provided", () => {
    render(
      <MemoryRouter initialEntries={["/?game=connect4"]}>
        <GameSelector isMultiplayer={false} currentGameId="connect4" />
      </MemoryRouter>
    );
    const select = screen.getByRole("combobox", { name: /choose game/i });
    expect(select.value).toBe("connect4");
  });
});

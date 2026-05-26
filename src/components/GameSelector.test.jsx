import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router-dom";
import "@shared/games/index.js"; // registers ttt, connect4, checkers
import GameSelector from "./GameSelector";

afterEach(() => {
  jest.restoreAllMocks();
});

function Harness({ initialEntries = ["/"], probe, selectorProps = {} }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <GameSelector
                isMultiplayer={false}
                currentGameId={null}
                {...selectorProps}
              />
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
    expect(screen.queryByRole("group", { name: /choose game/i })).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: /connect four/i }));

    expect(onSwitchGame).toHaveBeenCalledWith("connect4");
    expect(screen.getByTestId("probe").textContent).toBe("ttt");
  });

  test("renders one option per registered game", () => {
    render(<Harness />);
    const labels = screen.getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Tic-Tac-Toe", "Connect Four", "Checkers"]));
  });

  test("uses redesign sizing for desktop and mobile variants", () => {
    const { rerender } = render(
      <MemoryRouter>
        <GameSelector isMultiplayer={false} currentGameId="ttt" />
      </MemoryRouter>
    );

    expect(screen.getByRole("group", { name: /choose game/i })).toHaveClass(
      "hidden",
      "sm:flex",
      "items-center",
      "p-1",
      "bg-foreground/[0.03]",
      "border",
      "border-foreground/5",
      "rounded-full"
    );
    expect(screen.getByRole("button", { name: /tic-tac-toe/i })).toHaveClass(
      "px-4",
      "py-1.5",
      "text-xs",
      "font-medium",
      "rounded-full",
      "transition-all"
    );

    rerender(
      <MemoryRouter>
        <GameSelector
          variant="mobile"
          isMultiplayer={false}
          currentGameId="ttt"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("group", { name: /choose game/i })).toHaveClass(
      "sm:hidden",
      "flex",
      "items-center",
      "p-1",
      "bg-foreground/[0.03]",
      "border",
      "border-foreground/5",
      "rounded-full",
      "mb-8"
    );
    expect(screen.getByRole("button", { name: /tic-tac-toe/i })).toHaveClass(
      "px-3",
      "py-1.5",
      "text-xs",
      "font-medium",
      "rounded-full",
      "transition-all"
    );
  });

  test("local selection calls onSwitchGame and updates ?game= without reload", () => {
    const onSwitchGame = jest.fn();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <Harness
        probe
        selectorProps={{ currentGameId: "ttt", onSwitchGame }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /checkers/i }));

    expect(onSwitchGame).toHaveBeenCalledWith("checkers");
    expect(screen.getByTestId("probe").textContent).toBe("checkers");
    const navigationErrors = consoleError.mock.calls.filter((call) =>
      call.some((arg) =>
        String(arg?.message || arg).includes("Not implemented: navigation")
      )
    );
    expect(navigationErrors).toHaveLength(0);
  });

  test("selecting the default game clears the ?game= param", () => {
    render(<Harness initialEntries={["/?game=checkers"]} probe />);
    expect(screen.getByTestId("probe").textContent).toBe("checkers");
    fireEvent.click(screen.getByRole("button", { name: /tic-tac-toe/i }));
    expect(screen.getByTestId("probe").textContent).toBe("");
  });

  test("reflects currentGameId when provided", () => {
    render(
      <MemoryRouter initialEntries={["/?game=connect4"]}>
        <GameSelector isMultiplayer={false} currentGameId="connect4" />
      </MemoryRouter>
    );
    const button = screen.getByRole("button", { name: /connect four/i });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});

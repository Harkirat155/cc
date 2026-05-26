import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MatchActionBar from "./MatchActionBar";

jest.mock("../hooks/useShare", () => ({
  __esModule: true,
  default: () => ({ copied: false, share: jest.fn(), shareUrl: "" }),
}));

const setViewportWidth = (width) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
};

const renderActionBar = (props = {}) =>
  render(
    <MatchActionBar
      hasMoves={false}
      canResetScore={false}
      isMultiplayer={false}
      roomId=""
      onNewGame={jest.fn()}
      onResetScores={jest.fn()}
      onCreateMatch={jest.fn()}
      onFindMatch={jest.fn()}
      onLeaveRoom={jest.fn()}
      {...props}
    />
  );

describe("MatchActionBar", () => {
  beforeEach(() => {
    setViewportWidth(1024);
  });

  test("renders all actions inline on desktop", () => {
    renderActionBar({ hasMoves: true, canResetScore: true });

    expect(screen.getByRole("button", { name: "New Game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Scores" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find Match" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /more match actions/i })
    ).not.toBeInTheDocument();
  });

  test("caps mobile scored state to a primary action and overflow menu", () => {
    const onResetScores = jest.fn();
    setViewportWidth(375);
    renderActionBar({ hasMoves: true, canResetScore: true, onResetScores });

    expect(screen.getByRole("button", { name: "New Game" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more match actions/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset Scores" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Match" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Find Match" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /more match actions/i }));

    expect(screen.getByRole("menu", { name: /more match actions/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reset Scores" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Create Match" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Find Match" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Reset Scores" }));

    expect(onResetScores).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menu", { name: /more match actions/i })
    ).not.toBeInTheDocument();
  });

  test("keeps two direct mobile actions for ready states", () => {
    setViewportWidth(375);
    renderActionBar();

    expect(screen.getByRole("button", { name: "Create Match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find Match" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /more match actions/i })
    ).not.toBeInTheDocument();
  });
});

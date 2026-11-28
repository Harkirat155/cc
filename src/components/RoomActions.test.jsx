import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RoomActions from "./RoomActions";
import { tally } from "../lib/tally";

jest.mock("../lib/tally", () => ({ tally: jest.fn() }));

const roster = { X: "me", O: "them" };
const setup = (gameState, onAction = jest.fn(), reactions = true) => {
  render(<RoomActions gameState={{ status: "active", ...gameState }} socketId="me" roster={roster} onAction={onAction} reactions={reactions} />);
  return onAction;
};

test("resign needs a second click and window.confirm is never used", () => {
  const confirm = jest.spyOn(window, "confirm");
  const onAction = setup({});
  fireEvent.click(screen.getByText("Resign"));
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm resign"));
  expect(onAction).toHaveBeenCalledWith("resign");
  expect(confirm).not.toHaveBeenCalled();
});

test("an incoming draw offer shows Accept and Decline", () => {
  const onAction = setup({ drawOfferer: "them" });
  fireEvent.click(screen.getByText("Accept"));
  fireEvent.click(screen.getByText("Decline"));
  expect(onAction.mock.calls).toEqual([["acceptDraw"], ["declineDraw"]]);
});

test("six labelled reactions send the chosen value and tally once per send; resign hides when the game ended", () => {
  const onAction = setup({ status: "win" }, jest.fn(() => true));
  expect(screen.queryByText("Resign")).toBeNull();
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
    "Send thumbs up", "Send clap", "Send surprised", "Send relieved", "Send thinking", "Send fire",
  ]);
  fireEvent.click(screen.getByLabelText("Send fire"));
  expect(onAction).toHaveBeenCalledWith("emote", { emote: "🔥" });
  expect(tally).toHaveBeenCalledWith("cc", "react");
  expect(tally).toHaveBeenCalledTimes(1);
});

test("nothing is tallied when the send did not go out", () => {
  setup({ status: "win" }, jest.fn(() => false));
  fireEvent.click(screen.getByLabelText("Send thumbs up"));
  expect(tally).not.toHaveBeenCalled();
});

test("the buttons are disabled for 1 s after a send", () => {
  jest.useFakeTimers();
  const onAction = setup({ status: "win" });
  fireEvent.click(screen.getByLabelText("Send thumbs up"));
  const btns = screen.getAllByRole("button");
  expect(btns.every((b) => b.disabled)).toBe(true);
  fireEvent.click(btns[1]);
  expect(onAction).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(900); });
  expect(screen.getByLabelText("Send clap")).toBeDisabled();
  act(() => { jest.advanceTimersByTime(150); });
  expect(screen.getByLabelText("Send clap")).toBeEnabled();
  jest.useRealTimers();
});

test("no reaction buttons when the backend lacks reactions, resign still shows", () => {
  setup({}, jest.fn(), false);
  expect(screen.queryByLabelText("Send thumbs up")).toBeNull();
  expect(screen.getByText("Resign")).toBeInTheDocument();
});

test("a spectator sees no room actions, even while a draw is offered", () => {
  const { container } = render(
    <RoomActions gameState={{ status: "active", drawOfferer: "me" }} socketId="watcher" roster={roster} onAction={jest.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

beforeEach(() => tally.mockClear());

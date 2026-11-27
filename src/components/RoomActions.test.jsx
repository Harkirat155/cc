import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RoomActions from "./RoomActions";

const roster = { X: "me", O: "them" };
const setup = (gameState, onAction = jest.fn()) => {
  render(<RoomActions gameState={{ status: "active", ...gameState }} socketId="me" roster={roster} onAction={onAction} />);
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

test("emotes send the chosen value; resign is hidden once the game ended", () => {
  const onAction = setup({ status: "win" });
  expect(screen.queryByText("Resign")).toBeNull();
  fireEvent.click(screen.getByLabelText("Send 🔥"));
  expect(onAction).toHaveBeenCalledWith("emote", { emote: "🔥" });
});

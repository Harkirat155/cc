import { renderHook } from "@testing-library/react";
import useGameSounds from "./useGameSounds";
import * as sound from "../utils/sound";

const g = (board, turnSlot = 0) => ({ gameId: "ttt", status: "active", board, turnSlot, winnerSlot: null });
const empty = Array(9).fill(null);

it("stays silent inside the settle window after joining, then plays a move", () => {
  const play = jest.spyOn(sound, "playSound").mockImplementation(() => {});
  let now = 1000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  const { rerender } = renderHook(({ s }) => useGameSounds(s, 0, "room|connected"), { initialProps: { s: g(empty) } });
  rerender({ s: g(["X", ...empty.slice(1)], 1) }); // replay right after load
  expect(play).not.toHaveBeenCalled();
  now += 5000;
  rerender({ s: g(["X", "O", ...empty.slice(2)], 0) });
  expect(play).toHaveBeenCalledWith("moveTheirs");
  jest.restoreAllMocks();
});

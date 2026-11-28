import { act, renderHook } from "@testing-library/react";
import useShare from "./useShare";

const BASE = "https://cc-api.harkirat-hira.workers.dev";

describe("useShare", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() }, share: jest.fn().mockResolvedValue() });
  });

  test("builds the Worker /j/ link with the game, so chat unfurls it as that game", () => {
    const { result } = renderHook(() => useShare({ roomId: "ABCDE", gameId: "connect4" }));
    expect(result.current.shareUrl).toBe(`${BASE}/j/ABCDE?g=connect4`);
  });

  test("names the game in the share title and shares the same link", async () => {
    const { result } = renderHook(() => useShare({ roomId: "ABCDE", gameId: "checkers" }));
    await act(async () => { await result.current.share(); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${BASE}/j/ABCDE?g=checkers`);
    expect(navigator.share).toHaveBeenCalledWith({
      title: "Join my Checkers game",
      text: "Use this code ABCDE or open this link to join:",
      url: `${BASE}/j/ABCDE?g=checkers`,
    });
  });

  test("falls back to Tic-Tac-Toe when no game is known", () => {
    const { result } = renderHook(() => useShare({ roomId: "ABCDE" }));
    expect(result.current.shareUrl).toBe(`${BASE}/j/ABCDE?g=ttt`);
  });

  test("has no link without a room", () => {
    const { result } = renderHook(() => useShare({ roomId: "", gameId: "ttt" }));
    expect(result.current.shareUrl).toBeNull();
  });
});

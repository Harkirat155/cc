import {
  appendHistorySnapshot,
  createSystemEntry,
  indexToCoordinate,
} from "./history";

const emptyBoard = () => Array(9).fill("");

describe("history helpers", () => {
  test("appends a new move when board changes", () => {
    const start = createSystemEntry({
      board: emptyBoard(),
      message: "Start",
      moveNumber: 0,
    });
    const boardAfterMove = emptyBoard();
    boardAfterMove[0] = "X";

    const { history, appended } = appendHistorySnapshot([start], {
      board: boardAfterMove,
      result: "O to move",
      type: "move",
      moveNumber: 1,
      mark: "X",
      index: 0,
    });

    expect(appended).toBe(true);
    expect(history).toHaveLength(2);
    const latest = history[1];
    expect(latest.mark).toBe("X");
    expect(latest.coordinate).toBe("A1");
    expect(latest.result).toBe("O to move");
  });

  test("does not append duplicate snapshots and updates result", () => {
    const start = createSystemEntry({
      board: emptyBoard(),
      message: "Start",
      moveNumber: 0,
    });
    const boardAfterMove = emptyBoard();
    boardAfterMove[4] = "O";

    const first = appendHistorySnapshot([start], {
      board: boardAfterMove,
      result: "X to move",
      type: "move",
      moveNumber: 1,
      mark: "O",
      index: 4,
    });

    const second = appendHistorySnapshot(first.history, {
      board: boardAfterMove,
      result: "Awaiting rematch",
      type: "win",
      moveNumber: 1,
      mark: "O",
      index: 4,
    });

    expect(second.appended).toBe(false);
    expect(second.history).toHaveLength(2);
    expect(second.history[1].result).toBe("Awaiting rematch");
    expect(second.history[1].type).toBe("win");
  });

  test("indexToCoordinate maps board index to grid labels", () => {
    expect(indexToCoordinate(0)).toEqual({ index: 0, row: 0, column: 0, label: "A1" });
    expect(indexToCoordinate(8)).toEqual({ index: 8, row: 2, column: 2, label: "C3" });
    expect(indexToCoordinate(42)).toBeNull();
  });
});

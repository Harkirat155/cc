import {
  createCompletedGameSignature,
  normalizeSequenceStrings,
  shouldArchiveCompletedGame,
} from "./completedGames";

describe("completed games helpers", () => {
  test("normalizes and filters sequence strings", () => {
    expect(
      normalizeSequenceStrings(["X0", "  O4  ", null, "", "X8"])
    ).toEqual(["X0", "O4", "X8"]);
  });

  test("builds signature with timestamp", () => {
    const signature = createCompletedGameSignature(["X0", "O4"], 12345);
    expect(signature).toBe("X0-O4::12345");
  });

  test("prevents duplicate archive for same signature", () => {
    const sequence = ["X0", "O4", "X8"];
    const first = shouldArchiveCompletedGame({
      lastSignature: null,
      sequenceStrings: sequence,
      lastMoveTimestamp: 111,
    });
    expect(first.shouldArchive).toBe(true);

    const second = shouldArchiveCompletedGame({
      lastSignature: first.signature,
      sequenceStrings: sequence,
      lastMoveTimestamp: 111,
    });
    expect(second.shouldArchive).toBe(false);
  });

  test("allows identical sequence when timestamp changes", () => {
    const sequence = ["X0", "O4", "X8"];
    const first = shouldArchiveCompletedGame({
      lastSignature: null,
      sequenceStrings: sequence,
      lastMoveTimestamp: 200,
    });

    const second = shouldArchiveCompletedGame({
      lastSignature: first.signature,
      sequenceStrings: sequence,
      lastMoveTimestamp: 999,
    });

    expect(second.shouldArchive).toBe(true);
  });

  test("ignores archive when sequence empty", () => {
    const result = shouldArchiveCompletedGame({
      lastSignature: null,
      sequenceStrings: [],
      lastMoveTimestamp: 42,
    });
    expect(result.shouldArchive).toBe(false);
  });
});

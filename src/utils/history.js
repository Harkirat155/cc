const GRID_LOOKUP = [
  { index: 0, row: 0, column: 0, label: "A1" },
  { index: 1, row: 0, column: 1, label: "B1" },
  { index: 2, row: 0, column: 2, label: "C1" },
  { index: 3, row: 1, column: 0, label: "A2" },
  { index: 4, row: 1, column: 1, label: "B2" },
  { index: 5, row: 1, column: 2, label: "C2" },
  { index: 6, row: 2, column: 0, label: "A3" },
  { index: 7, row: 2, column: 1, label: "B3" },
  { index: 8, row: 2, column: 2, label: "C3" },
];

const GRID_BY_INDEX = GRID_LOOKUP.reduce((acc, cell) => {
  acc[cell.index] = cell;
  return acc;
}, {});

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const boardSignature = (board = []) =>
  Array.isArray(board) ? board.join("|") : "";

export const detectChangedIndex = (prev = [], next = []) => {
  if (!Array.isArray(prev) || !Array.isArray(next)) return null;
  const length = Math.min(prev.length, next.length);
  for (let i = 0; i < length; i += 1) {
    if (prev[i] !== next[i]) return i;
  }
  return null;
};

export const indexToCoordinate = (index) => {
  if (typeof index !== "number" || index < 0 || index > 8) return null;
  return GRID_BY_INDEX[index] || null;
};

const createBaseEntry = ({
  board,
  result,
  moveNumber = 0,
  type = "system",
  timestamp = Date.now(),
}) => ({
  id: randomId(),
  move: moveNumber,
  result,
  type,
  timestamp,
  squares: Array.isArray(board) ? board.slice() : [],
  signature: boardSignature(board),
});

export const createMoveEntry = ({
  board,
  result,
  moveNumber = 0,
  mark = null,
  index = null,
  type = "move",
  timestamp,
}) => {
  const base = createBaseEntry({ board, result, moveNumber, type, timestamp });
  const coord = indexToCoordinate(index);
  return {
    ...base,
    mark,
    index: typeof index === "number" ? index : null,
    coordinate: coord?.label ?? null,
    row: coord?.row ?? null,
    column: coord?.column ?? null,
  };
};

export const createSystemEntry = ({
  board,
  message,
  moveNumber = 0,
  tag = "system",
  timestamp,
}) =>
  createMoveEntry({
    board,
    result: message,
    moveNumber,
    mark: null,
    index: null,
    type: tag,
    timestamp,
  });

export const appendHistorySnapshot = (
  history,
  {
    board,
    result,
    type = "move",
    moveNumber = 0,
    mark = null,
    index = null,
    timestamp,
  }
) => {
  const normalizedBoard = Array.isArray(board) ? board.slice() : [];
  const signature = boardSignature(normalizedBoard);
  const last = history[history.length - 1];

  if (last?.signature === signature) {
    const shouldUpdateResult =
      typeof result === "string" && result.length > 0 && result !== last.result;
    const shouldUpdateType = type && type !== last.type;

    if (shouldUpdateResult || shouldUpdateType) {
      const next = history.slice();
      next[next.length - 1] = {
        ...last,
        result: shouldUpdateResult ? result : last.result,
        type: shouldUpdateType ? type : last.type,
      };
      return { history: next, appended: false, signature, entry: next[next.length - 1] };
    }

    return { history, appended: false, signature, entry: last };
  }

  const entry =
    type === "system" || type === "reset"
      ? createSystemEntry({ board: normalizedBoard, message: result, moveNumber, tag: type, timestamp })
      : createMoveEntry({
          board: normalizedBoard,
          result,
          moveNumber,
          mark,
          index,
          type,
          timestamp,
        });

  return {
    history: [...history, entry],
    appended: true,
    signature,
    entry,
  };
};

export const GRID_COORDINATES = GRID_LOOKUP;

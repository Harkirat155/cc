// Connect Four — validates the grid-mark abstraction with a non-square board
// and a "column drop" placement primitive (cell index = lowest empty row in
// the chosen column).
//
// Slots: 0 = first player, 1 = second player. Board is row-major, top to
// bottom, left to right (row 0 = top). A piece in row r, col c lives at
// `board[r * COLS + c]`.

const ROWS = 6;
const COLS = 7;
const CELLS = ROWS * COLS;
const WIN_LEN = 4;

/** @type {import('./types.js').BoardSpec} */
const BOARD_SPEC = { kind: 'grid', rows: ROWS, cols: COLS };

const SLOT_LABEL = ['R', 'Y'];
const SLOT_BY_LABEL = new Map(SLOT_LABEL.map((label, slot) => [label, slot]));

const idx = (r, c) => r * COLS + c;

/** Lowest empty row in column `col`, or -1 if full. */
function landingRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[idx(r, col)] === '') return r;
  }
  return -1;
}

/** All 4-in-a-row line offsets, generated once. */
const LINES = (() => {
  const out = [];
  const dirs = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diag down-right
    [1, -1],  // diag down-left
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + dr * (WIN_LEN - 1);
        const ec = c + dc * (WIN_LEN - 1);
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        const cells = [];
        for (let k = 0; k < WIN_LEN; k++) cells.push(idx(r + dr * k, c + dc * k));
        out.push(cells);
      }
    }
  }
  return out;
})();

/** @returns {import('./types.js').GameState} */
function createInitialState() {
  return {
    board: Array(CELLS).fill(''),
    turn: 0,
    status: 'active',
    winner: null,
    winningCells: [],
    scores: [0, 0],
    moveCount: 0,
  };
}

/** @returns {import('./types.js').TerminalResult} */
function checkTerminal(state) {
  const { board } = state;
  for (const line of LINES) {
    const [a, b, c, d] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c] && v === board[d]) {
      const winnerSlot = SLOT_BY_LABEL.get(v);
      return { status: 'win', winner: winnerSlot, line };
    }
  }
  if (board.every((cell) => cell !== '')) {
    return { status: 'draw', winner: null, line: [] };
  }
  return { status: 'active', winner: null, line: [] };
}

/** @returns {import('./types.js').Move[]} */
function getLegalMoves(state, slot) {
  if (state.status !== 'active' || state.turn !== slot) return [];
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    if (landingRow(state.board, c) >= 0) moves.push({ type: 'place', cell: c });
  }
  return moves;
}

/**
 * For Connect Four the `cell` field of a `place` move is the COLUMN index
 * (0..6), not the absolute cell. The chip lands at the lowest empty row.
 * This keeps the makeMove wire shape identical across grid-mark games while
 * letting per-game rules pick their own semantics.
 */
function applyMove(state, move, slot) {
  if (move.type !== 'place') throw new Error(`connect4.applyMove: unsupported move type ${move.type}`);
  if (state.status !== 'active') throw new Error('connect4.applyMove: game already finished');
  if (state.turn !== slot) throw new Error(`connect4.applyMove: not slot ${slot}'s turn`);

  const col = move.cell;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) {
    throw new Error(`connect4.applyMove: column out of range: ${col}`);
  }
  const row = landingRow(state.board, col);
  if (row < 0) throw new Error(`connect4.applyMove: column ${col} full`);

  const board = state.board.slice();
  const cell = idx(row, col);
  board[cell] = SLOT_LABEL[slot];

  const nextBase = {
    ...state,
    board,
    moveCount: state.moveCount + 1,
  };
  const terminal = checkTerminal(nextBase);

  let next;
  if (terminal.status === 'win') {
    const scores = [state.scores[0], state.scores[1]];
    scores[terminal.winner] += 1;
    next = {
      ...nextBase,
      status: 'win',
      winner: terminal.winner,
      winningCells: terminal.line || [],
      scores,
    };
  } else if (terminal.status === 'draw') {
    next = { ...nextBase, status: 'draw', winner: null, winningCells: [] };
  } else {
    next = { ...nextBase, turn: slot === 0 ? 1 : 0 };
  }

  return {
    state: next,
    events: [{ type: 'placed', affectedCells: [cell], column: col, row }],
  };
}

function describeMove(move) {
  if (move.type !== 'place') return '';
  return `col ${move.cell + 1}`;
}

// A click on any cell in column `c` drops a chip into that column.
function moveFromCellClick(_state, index) {
  return { type: 'place', cell: index % COLS };
}

/** @type {import('./rules.js').GameRules} */
const connect4 = {
  id: 'connect4',
  displayName: 'Connect Four',
  players: 2,
  playerInfo: [
    { slot: 0, label: 'Red', color: 'red' },
    { slot: 1, label: 'Yellow', color: 'amber' },
  ],
  boardSpec: BOARD_SPEC,
  createInitialState,
  getLegalMoves,
  applyMove,
  checkTerminal,
  describeMove,
  moveFromCellClick,
};

export default connect4;

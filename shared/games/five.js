// Five in a Row — 15x15 grid, players alternately place a stone on any empty
// cell; the first to make an unbroken line of five or more (horizontal,
// vertical or diagonal) wins. A full board is a draw.
//
// Slots: 0 = first player (Blue, 'B'), 1 = second player (Green, 'G').
// Board is row-major; `cell` of a `place` move is the absolute index.

const SIZE = 15;
const CELLS = SIZE * SIZE;
const WIN_LEN = 5;

/** @type {import('./types.js').BoardSpec} */
const BOARD_SPEC = { kind: 'grid', rows: SIZE, cols: SIZE };

const SLOT_LABEL = ['B', 'G'];
const SLOT_BY_LABEL = new Map(SLOT_LABEL.map((label, slot) => [label, slot]));

const idx = (r, c) => r * SIZE + c;
const inBoard = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

const DIRS = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diag down-right
  [1, -1],  // diag down-left
];

/**
 * Every maximal run of one mark, as { mark, cells, open } where `open` is the
 * number of empty cells capping its ends (0..2). Runs start where the previous
 * cell in that direction is not the same mark.
 */
function runs(board) {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const mark = board[idx(r, c)];
      if (!mark) continue;
      for (const [dr, dc] of DIRS) {
        if (inBoard(r - dr, c - dc) && board[idx(r - dr, c - dc)] === mark) continue;
        const cells = [];
        let rr = r;
        let cc = c;
        while (inBoard(rr, cc) && board[idx(rr, cc)] === mark) {
          cells.push(idx(rr, cc));
          rr += dr;
          cc += dc;
        }
        let open = 0;
        if (inBoard(rr, cc) && board[idx(rr, cc)] === '') open++;
        if (inBoard(r - dr, c - dc) && board[idx(r - dr, c - dc)] === '') open++;
        out.push({ mark, cells, open });
      }
    }
  }
  return out;
}

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
  for (const run of runs(board)) {
    if (run.cells.length >= WIN_LEN) {
      return { status: 'win', winner: SLOT_BY_LABEL.get(run.mark), line: run.cells };
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
  for (let i = 0; i < CELLS; i++) {
    if (state.board[i] === '') moves.push({ type: 'place', cell: i });
  }
  return moves;
}

function applyMove(state, move, slot) {
  if (move.type !== 'place') throw new Error(`five.applyMove: unsupported move type ${move.type}`);
  if (state.status !== 'active') throw new Error('five.applyMove: game already finished');
  if (state.turn !== slot) throw new Error(`five.applyMove: not slot ${slot}'s turn`);

  const cell = move.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) {
    throw new Error(`five.applyMove: cell out of range: ${cell}`);
  }
  if (state.board[cell] !== '') throw new Error(`five.applyMove: cell ${cell} is occupied`);

  const board = state.board.slice();
  board[cell] = SLOT_LABEL[slot];

  const nextBase = { ...state, board, moveCount: state.moveCount + 1 };
  const terminal = checkTerminal(nextBase);

  let next;
  if (terminal.status === 'win') {
    const scores = [state.scores[0], state.scores[1]];
    scores[terminal.winner] += 1;
    next = { ...nextBase, status: 'win', winner: terminal.winner, winningCells: terminal.line, scores };
  } else if (terminal.status === 'draw') {
    next = { ...nextBase, status: 'draw', winner: null, winningCells: [] };
  } else {
    next = { ...nextBase, turn: slot === 0 ? 1 : 0 };
  }

  return { state: next, events: [{ type: 'placed', affectedCells: [cell] }] };
}

function describeMove(move) {
  if (move.type !== 'place') return '';
  return `row ${Math.floor(move.cell / SIZE) + 1}, col ${(move.cell % SIZE) + 1}`;
}

function moveFromCellClick(_state, index) {
  return { type: 'place', cell: index };
}

// Weight per run length, by number of open ends (index 0..2).
const WEIGHTS = {
  2: [0, 1, 4],
  3: [0, 10, 100],
  4: [0, 100, 10000],
};

/**
 * Heuristic position value from `slot`'s point of view: open-four and
 * open-three counting. Positive favours `slot`, negative favours the opponent.
 */
function evaluate(state, slot) {
  const mine = SLOT_LABEL[slot];
  let score = 0;
  for (const { mark, cells, open } of runs(state.board)) {
    const w = cells.length >= WIN_LEN ? 1e6 : WEIGHTS[cells.length]?.[open] ?? 0;
    score += mark === mine ? w : -w;
  }
  return score;
}

/** @type {import('./rules.js').GameRules} */
const five = {
  id: 'five',
  displayName: 'Five in a Row',
  players: 2,
  playerInfo: [
    { slot: 0, label: 'Blue', color: 'sky' },
    { slot: 1, label: 'Green', color: 'emerald' },
  ],
  boardSpec: BOARD_SPEC,
  createInitialState,
  getLegalMoves,
  applyMove,
  checkTerminal,
  describeMove,
  moveFromCellClick,
  evaluate,
};

export default five;

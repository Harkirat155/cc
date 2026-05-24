// Tic-Tac-Toe — first GameRules adapter.
//
// Behavior is intentionally bit-identical to the legacy server/gameLogic.js so
// existing rooms keep working when the server is migrated to the registry.
// The slot-indexed contract (0/1, scores: [n,n]) is the *internal* representation;
// the legacy 'X'/'O' wire format is preserved via mark<->slot helpers below
// until the server is fully converted.

/** @type {import('./types.js').BoardSpec} */
const BOARD_SPEC = { kind: 'grid', rows: 3, cols: 3 };

/** Slot -> mark (legacy compatibility). Slot 0 = 'X' (first player), Slot 1 = 'O'. */
export const SLOT_TO_MARK = ['X', 'O'];

/**
 * Mark -> slot (legacy compatibility).
 * @param {string} mark
 * @returns {0 | 1 | -1}
 */
export const markToSlot = (mark) => (mark === 'X' ? 0 : mark === 'O' ? 1 : -1);

// All winning lines on a 3x3 board (rows, columns, both diagonals).
// Kept identical to server/gameLogic.js#LINES so a side-by-side diff is trivial.
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** @returns {import('./types.js').GameState} */
function createInitialState() {
  return {
    board: Array(9).fill(''),
    turn: 0,
    status: 'active',
    winner: null,
    winningCells: [],
    scores: [0, 0],
    moveCount: 0,
  };
}

/**
 * @param {import('./types.js').GameState} state
 * @returns {import('./types.js').TerminalResult}
 */
function checkTerminal(state) {
  const { board } = state;
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { status: 'win', winner: markToSlot(board[a]), line: [a, b, c] };
    }
  }
  if (board.every((cell) => cell !== '')) {
    return { status: 'draw', winner: null, line: [] };
  }
  return { status: 'active', winner: null, line: [] };
}

/**
 * @param {import('./types.js').GameState} state
 * @param {import('./types.js').Slot} slot
 * @returns {import('./types.js').Move[]}
 */
function getLegalMoves(state, slot) {
  if (state.status !== 'active' || state.turn !== slot) return [];
  const moves = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === '') moves.push({ type: 'place', cell: i });
  }
  return moves;
}

/**
 * @param {import('./types.js').GameState} state
 * @param {import('./types.js').Move} move
 * @param {import('./types.js').Slot} slot
 * @returns {import('./types.js').ApplyMoveResult}
 */
function applyMove(state, move, slot) {
  if (move.type !== 'place') throw new Error(`ttt.applyMove: unsupported move type ${move.type}`);
  if (state.status !== 'active') throw new Error('ttt.applyMove: game already finished');
  if (state.turn !== slot) throw new Error(`ttt.applyMove: not slot ${slot}'s turn`);
  const { cell } = move;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    throw new Error(`ttt.applyMove: cell out of range: ${cell}`);
  }
  if (state.board[cell] !== '') throw new Error(`ttt.applyMove: cell ${cell} occupied`);

  const board = state.board.slice();
  board[cell] = SLOT_TO_MARK[slot];

  const nextBase = {
    ...state,
    board,
    moveCount: state.moveCount + 1,
  };
  const terminal = checkTerminal(nextBase);

  let next;
  if (terminal.status === 'win') {
    const scores = /** @type {[number, number]} */ ([state.scores[0], state.scores[1]]);
    scores[/** @type {0 | 1} */ (terminal.winner)] += 1;
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
    next = { ...nextBase, turn: /** @type {import('./types.js').Slot} */ (slot === 0 ? 1 : 0) };
  }

  return {
    state: next,
    events: [{ type: 'placed', affectedCells: [cell] }],
  };
}

/**
 * @param {import('./types.js').Move} move
 * @returns {string}
 */
function describeMove(move) {
  if (move.type !== 'place') return '';
  return `cell ${move.cell}`;
}

/** @type {import('./rules.js').GameRules} */
const ttt = {
  id: 'ttt',
  displayName: 'Tic-Tac-Toe',
  players: 2,
  playerInfo: [
    { slot: 0, label: 'X', color: 'sky' },
    { slot: 1, label: 'O', color: 'rose' },
  ],
  boardSpec: BOARD_SPEC,
  createInitialState,
  getLegalMoves,
  applyMove,
  checkTerminal,
  describeMove,
};

export default ttt;

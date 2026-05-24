// Checkers (English draughts) — second GameRules adapter exercising the
// piece-movement primitive (transfer moves with captures + promotion).
//
// Scope: a deliberately simplified rules set that's enough to validate the
// abstraction stack end-to-end:
//   - Standard 8x8 board, dark squares playable (12 pieces per side).
//   - Men move/jump diagonally forward only; kings move/jump any diagonal.
//   - Single jumps only — no multi-jump chains, no mandatory captures.
//   - Promotion to king on reaching the opponent's back row.
//   - Terminal: opponent has no pieces OR has no legal moves (win for mover).
//   - No draws.
//
// Wire shape: board is a 64-element array; empty cells are '', occupied cells
// are { type: 'man'|'king', owner: 0|1 }. Moves are
//   { type: 'transfer', from, to, captures?: [cellIdx] }.

/** @type {import('./types.js').BoardSpec} */
const BOARD_SPEC = { kind: 'grid', rows: 8, cols: 8, dark: true };
const ROWS = 8;
const COLS = 8;

const FORWARD_BY_SLOT = [-1, +1]; // slot 0 moves up (row--), slot 1 moves down
const BACK_ROW_BY_SLOT = [0, 7];  // promotion target

const idx = (r, c) => r * COLS + c;
const rc = (i) => [Math.floor(i / COLS), i % COLS];
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const isPlayable = (r, c) => (r + c) % 2 === 1;

function pieceAt(board, r, c) {
  if (!inBounds(r, c)) return null;
  const cell = board[idx(r, c)];
  return cell && typeof cell === 'object' ? cell : null;
}

function createInitialState() {
  const board = Array(ROWS * COLS).fill('');
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isPlayable(r, c)) continue;
      if (r <= 2) board[idx(r, c)] = { type: 'man', owner: 1 };
      else if (r >= 5) board[idx(r, c)] = { type: 'man', owner: 0 };
    }
  }
  return {
    board,
    turn: 0,
    status: 'active',
    winner: null,
    winningCells: [],
    scores: [0, 0],
    moveCount: 0,
  };
}

function movesFromPiece(board, r, c, piece) {
  const moves = [];
  const dirs = piece.type === 'king' ? [-1, 1] : [FORWARD_BY_SLOT[piece.owner]];
  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || !isPlayable(nr, nc)) continue;
      const adjacent = board[idx(nr, nc)];
      if (adjacent === '') {
        moves.push({ type: 'transfer', from: idx(r, c), to: idx(nr, nc) });
        continue;
      }
      // Try a jump over an opponent piece.
      if (typeof adjacent === 'object' && adjacent.owner !== piece.owner) {
        const jr = nr + dr;
        const jc = nc + dc;
        if (inBounds(jr, jc) && isPlayable(jr, jc) && board[idx(jr, jc)] === '') {
          moves.push({
            type: 'transfer',
            from: idx(r, c),
            to: idx(jr, jc),
            captures: [idx(nr, nc)],
          });
        }
      }
    }
  }
  return moves;
}

/**
 * @param {import('./types.js').GameState} state
 * @param {import('./types.js').Slot} slot
 * @param {number} [fromIdx] Optional: when provided, only return moves originating at this cell.
 * @returns {import('./types.js').Move[]}
 */
function getLegalMoves(state, slot, fromIdx) {
  if (state.status !== 'active' || state.turn !== slot) return [];

  if (typeof fromIdx === 'number') {
    const [r, c] = rc(fromIdx);
    const piece = pieceAt(state.board, r, c);
    if (!piece || piece.owner !== slot) return [];
    return movesFromPiece(state.board, r, c, piece);
  }

  const out = [];
  for (let i = 0; i < state.board.length; i++) {
    const cell = state.board[i];
    if (!cell || typeof cell !== 'object' || cell.owner !== slot) continue;
    const [r, c] = rc(i);
    out.push(...movesFromPiece(state.board, r, c, cell));
  }
  return out;
}

function captureKey(captures) {
  return Array.isArray(captures) && captures.length ? captures.join(',') : '';
}

function applyMove(state, move, slot) {
  if (move.type !== 'transfer') {
    throw new Error(`checkers.applyMove: unsupported move type ${move.type}`);
  }
  if (state.status !== 'active') {
    throw new Error('checkers.applyMove: game already finished');
  }
  if (state.turn !== slot) {
    throw new Error(`checkers.applyMove: not slot ${slot}'s turn`);
  }

  const legalMoves = getLegalMoves(state, slot, move.from);
  const wantedCaptures = captureKey(move.captures);
  const match = legalMoves.find(
    (m) => m.from === move.from && m.to === move.to && captureKey(m.captures) === wantedCaptures
  );
  if (!match) {
    throw new Error(`checkers.applyMove: illegal move ${JSON.stringify(move)}`);
  }

  const board = state.board.slice();
  const piece = board[move.from];
  board[move.from] = '';
  for (const cap of match.captures || []) board[cap] = '';

  const [toRow] = rc(move.to);
  const becomeKing = piece.type === 'man' && toRow === BACK_ROW_BY_SLOT[slot];
  board[move.to] = becomeKing
    ? { type: 'king', owner: slot }
    : { type: piece.type, owner: piece.owner };

  const events = [
    {
      type: match.captures?.length ? 'jump' : 'step',
      affectedCells: [move.from, move.to, ...(match.captures || [])],
    },
  ];
  if (becomeKing) events.push({ type: 'promote', cell: move.to });

  const opponentSlot = slot === 0 ? 1 : 0;
  // Terminal: opponent has no pieces or no legal moves.
  let opponentMoves = 0;
  let opponentPieces = 0;
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (!cell || typeof cell !== 'object' || cell.owner !== opponentSlot) continue;
    opponentPieces += 1;
    const [r, c] = rc(i);
    if (movesFromPiece(board, r, c, cell).length > 0) {
      opponentMoves += 1;
      break; // we only need to know "at least one" — short-circuit
    }
  }

  let next;
  if (opponentPieces === 0 || opponentMoves === 0) {
    const scores = [state.scores[0] || 0, state.scores[1] || 0];
    scores[slot] += 1;
    next = {
      ...state,
      board,
      status: 'win',
      winner: slot,
      winningCells: [move.to],
      scores,
      moveCount: state.moveCount + 1,
    };
  } else {
    next = {
      ...state,
      board,
      turn: opponentSlot,
      moveCount: state.moveCount + 1,
    };
  }
  return { state: next, events };
}

function checkTerminal(state) {
  if (state.status === 'win') {
    return { status: 'win', winner: state.winner, line: state.winningCells || [] };
  }
  if (state.status === 'draw') {
    return { status: 'draw', winner: null, line: [] };
  }
  return { status: 'active', winner: null, line: [] };
}

function describeMove(move) {
  if (move.type !== 'transfer') return '';
  const captures = (move.captures || []).length;
  return captures ? `${move.from}→${move.to} (×${captures})` : `${move.from}→${move.to}`;
}

/** @type {import('./rules.js').GameRules} */
const checkers = {
  id: 'checkers',
  displayName: 'Checkers',
  players: 2,
  playerInfo: [
    { slot: 0, label: 'R', color: 'red' },
    { slot: 1, label: 'Y', color: 'amber' },
  ],
  boardSpec: BOARD_SPEC,
  moveStyle: 'select-target',
  createInitialState,
  getLegalMoves,
  applyMove,
  checkTerminal,
  describeMove,
};

export default checkers;

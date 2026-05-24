import checkers from '../checkers.js';
import { assertGameRules } from '../rules.js';

const COLS = 8;
const ROWS = 8;
const idx = (r, c) => r * COLS + c;

function setPiece(state, r, c, piece) {
  const board = state.board.slice();
  board[idx(r, c)] = piece;
  return { ...state, board };
}

function emptyBoardState(turn = 0) {
  return {
    board: Array(ROWS * COLS).fill(''),
    turn,
    status: 'active',
    winner: null,
    winningCells: [],
    scores: [0, 0],
    moveCount: 0,
  };
}

describe('checkers — contract', () => {
  test('satisfies GameRules contract', () => {
    expect(() => assertGameRules(checkers)).not.toThrow();
  });

  test('boardSpec is 8x8 dark-square grid', () => {
    expect(checkers.boardSpec).toEqual({ kind: 'grid', rows: 8, cols: 8, dark: true });
  });

  test('moveStyle is select-target', () => {
    expect(checkers.moveStyle).toBe('select-target');
  });
});

describe('checkers — initial setup', () => {
  test('12 pieces per side on dark squares only', () => {
    const s = checkers.createInitialState();
    const slot0 = s.board.filter((c) => c && c.owner === 0);
    const slot1 = s.board.filter((c) => c && c.owner === 1);
    expect(slot0).toHaveLength(12);
    expect(slot1).toHaveLength(12);
    s.board.forEach((cell, i) => {
      if (!cell) return;
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      expect((r + c) % 2).toBe(1);
    });
  });

  test('slot 0 starts at the bottom (rows 5-7)', () => {
    const s = checkers.createInitialState();
    for (let i = 0; i < s.board.length; i++) {
      const cell = s.board[i];
      if (!cell) continue;
      const r = Math.floor(i / COLS);
      if (cell.owner === 0) expect(r).toBeGreaterThanOrEqual(5);
      else expect(r).toBeLessThanOrEqual(2);
    }
  });

  test('slot 0 moves first', () => {
    expect(checkers.createInitialState().turn).toBe(0);
  });
});

describe('checkers — legal moves', () => {
  test('initial state: each side has exactly 7 forward step moves', () => {
    const s = checkers.createInitialState();
    const slot0Moves = checkers.getLegalMoves(s, 0);
    // The 4 front-rank men can each step diagonally. Edge men have 1 step
    // each (3 men), interior men have 2 steps (1 man). 3*1 + 1*2 = 5? Wait —
    // standard front-rank layout has 4 men on row 5 (cols where (5+c) odd:
    // c = 0,2,4,6). Edges = col 0 and col 6 (only one diagonal forward
    // playable: col 1 and col 5). Interiors col 2 and col 4 have two
    // diagonals each. Total = 1 + 2 + 2 + 1 = 6 — wait, col 6 forward
    // diagonals would be cols 5 and 7, both playable. So all four men have
    // two diagonals... no, edges only have one diagonal *inside* the board:
    // col 0 → cols -1 (out) and 1 → 1 step.  col 6 → cols 5 and 7 → 2 steps.
    // So 1 + 2 + 2 + 2 = 7.
    expect(slot0Moves).toHaveLength(7);
    const slot1Moves = checkers.getLegalMoves({ ...s, turn: 1 }, 1);
    expect(slot1Moves).toHaveLength(7);
  });

  test('out-of-turn returns no moves', () => {
    const s = checkers.createInitialState();
    expect(checkers.getLegalMoves(s, 1)).toEqual([]);
  });

  test('king moves both directions', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'king', owner: 0 });
    const moves = checkers.getLegalMoves(s, 0, idx(4, 3));
    // From (4,3) a king can go to (3,2), (3,4), (5,2), (5,4) — all 4 diagonals.
    expect(moves).toHaveLength(4);
  });

  test('man moves only forward', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    const moves = checkers.getLegalMoves(s, 0, idx(4, 3));
    // slot 0 forward = row--; from (4,3) → (3,2) and (3,4).
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => Math.floor(m.to / COLS) === 3)).toBe(true);
  });
});

describe('checkers — jumps and captures', () => {
  test('man jumps adjacent opponent into empty square', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    s = setPiece(s, 3, 4, { type: 'man', owner: 1 });
    // (4,3) → jumps over (3,4) → lands at (2,5).
    const moves = checkers.getLegalMoves(s, 0, idx(4, 3));
    const jump = moves.find((m) => m.captures?.length);
    expect(jump).toEqual({
      type: 'transfer',
      from: idx(4, 3),
      to: idx(2, 5),
      captures: [idx(3, 4)],
    });
  });

  test('applyMove removes the captured piece', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    s = setPiece(s, 3, 4, { type: 'man', owner: 1 });
    s = setPiece(s, 0, 1, { type: 'man', owner: 1 }); // give slot 1 a piece so no terminal
    const { state, events } = checkers.applyMove(
      s,
      { type: 'transfer', from: idx(4, 3), to: idx(2, 5), captures: [idx(3, 4)] },
      0
    );
    expect(state.board[idx(3, 4)]).toBe('');
    expect(state.board[idx(4, 3)]).toBe('');
    expect(state.board[idx(2, 5)]).toEqual({ type: 'man', owner: 0 });
    expect(events[0].affectedCells).toEqual([idx(4, 3), idx(2, 5), idx(3, 4)]);
    expect(state.turn).toBe(1);
  });

  test('illegal move (not in legal set) throws', () => {
    const s = checkers.createInitialState();
    expect(() =>
      checkers.applyMove(s, { type: 'transfer', from: idx(5, 0), to: idx(3, 2) }, 0)
    ).toThrow(/illegal/);
  });
});

describe('checkers — promotion', () => {
  test('man becomes king on reaching opponent back row', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 1, 2, { type: 'man', owner: 0 });
    s = setPiece(s, 7, 0, { type: 'man', owner: 1 }); // keep slot 1 alive
    const { state, events } = checkers.applyMove(
      s,
      { type: 'transfer', from: idx(1, 2), to: idx(0, 1) },
      0
    );
    expect(state.board[idx(0, 1)]).toEqual({ type: 'king', owner: 0 });
    expect(events.some((e) => e.type === 'promote')).toBe(true);
  });
});

describe('checkers — terminal', () => {
  test('capturing last opponent ends the game (mover wins)', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    s = setPiece(s, 3, 4, { type: 'man', owner: 1 });
    const { state } = checkers.applyMove(
      s,
      { type: 'transfer', from: idx(4, 3), to: idx(2, 5), captures: [idx(3, 4)] },
      0
    );
    expect(state.status).toBe('win');
    expect(state.winner).toBe(0);
    expect(state.scores[0]).toBe(1);
  });

  test('opponent locked with no legal moves: mover wins', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    // Slot 1 is in the corner with no diagonal-forward target.
    s = setPiece(s, 7, 7, { type: 'man', owner: 1 });
    const { state } = checkers.applyMove(
      s,
      { type: 'transfer', from: idx(4, 3), to: idx(3, 2) },
      0
    );
    // Slot 1 has 1 piece but it's a slot-1 man at (7,7) — forward = row++ so
    // can't move (off the board). Mover wins.
    expect(state.status).toBe('win');
    expect(state.winner).toBe(0);
  });

  test('post-terminal applyMove throws', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    s = setPiece(s, 3, 4, { type: 'man', owner: 1 });
    const { state } = checkers.applyMove(
      s,
      { type: 'transfer', from: idx(4, 3), to: idx(2, 5), captures: [idx(3, 4)] },
      0
    );
    expect(() =>
      checkers.applyMove(state, { type: 'transfer', from: idx(2, 5), to: idx(1, 4) }, 1)
    ).toThrow(/finished/);
  });
});

describe('checkers — immutability', () => {
  test('applyMove does not mutate prior state', () => {
    let s = emptyBoardState(0);
    s = setPiece(s, 4, 3, { type: 'man', owner: 0 });
    s = setPiece(s, 0, 1, { type: 'man', owner: 1 });
    const before = JSON.stringify(s.board);
    checkers.applyMove(s, { type: 'transfer', from: idx(4, 3), to: idx(3, 2) }, 0);
    expect(JSON.stringify(s.board)).toBe(before);
  });
});

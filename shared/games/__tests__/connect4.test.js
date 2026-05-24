import connect4 from '../connect4.js';
import { assertGameRules } from '../rules.js';

const COLS = 7;
const ROWS = 6;
const idx = (r, c) => r * COLS + c;

// Apply a sequence of column drops, alternating slots starting at 0.
function play(cols) {
  let state = connect4.createInitialState();
  let slot = 0;
  for (const col of cols) {
    ({ state } = connect4.applyMove(state, { type: 'place', cell: col }, slot));
    slot = slot === 0 ? 1 : 0;
  }
  return state;
}

describe('connect4 — contract', () => {
  test('satisfies GameRules contract', () => {
    expect(() => assertGameRules(connect4)).not.toThrow();
  });

  test('boardSpec is 6x7', () => {
    expect(connect4.boardSpec).toEqual({ kind: 'grid', rows: 6, cols: 7 });
  });

  test('initial state is empty, turn=0, scores=[0,0]', () => {
    const s = connect4.createInitialState();
    expect(s.board.length).toBe(42);
    expect(s.board.every((c) => c === '')).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.scores).toEqual([0, 0]);
    expect(s.status).toBe('active');
  });
});

describe('connect4 — gravity', () => {
  test('first chip in a column lands on the bottom row', () => {
    const s = play([3]);
    expect(s.board[idx(ROWS - 1, 3)]).toBe('R');
    expect(s.board[idx(ROWS - 2, 3)]).toBe('');
  });

  test('stacking fills column bottom-up', () => {
    const s = play([0, 0, 0, 0]); // R Y R Y
    expect(s.board[idx(5, 0)]).toBe('R');
    expect(s.board[idx(4, 0)]).toBe('Y');
    expect(s.board[idx(3, 0)]).toBe('R');
    expect(s.board[idx(2, 0)]).toBe('Y');
    expect(s.board[idx(1, 0)]).toBe('');
  });

  test('full column rejects further drops', () => {
    let s = play([0, 0, 0, 0, 0, 0]); // 6 chips
    const slot = s.turn;
    expect(() => connect4.applyMove(s, { type: 'place', cell: 0 }, slot)).toThrow(/full/);
  });
});

describe('connect4 — terminal detection', () => {
  test('horizontal 4-in-a-row wins', () => {
    // R drops cols 0..3 on bottom row, Y answers higher up
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(s.status).toBe('win');
    expect(s.winner).toBe(0);
    expect(s.winningCells.length).toBe(4);
    expect(s.scores).toEqual([1, 0]);
  });

  test('vertical 4-in-a-row wins', () => {
    // R: col 0 four times, Y: col 1 three times
    const s = play([0, 1, 0, 1, 0, 1, 0]);
    expect(s.status).toBe('win');
    expect(s.winner).toBe(0);
  });

  test('diagonal (down-right) win', () => {
    // Build R diagonal at cells (5,0),(4,1),(3,2),(2,3)
    // Sequence engineered so R lands on those cells.
    const seq = [
      0,        // R -> (5,0)
      1,        // Y -> (5,1)
      1,        // R -> (4,1)
      2,        // Y -> (5,2)
      3,        // R -> (5,3)  filler so col 2 needs Y next
      2,        // Y -> (4,2)
      2,        // R -> (3,2)
      3,        // Y -> (4,3)
      6,        // R -> (5,6) filler
      3,        // Y -> (3,3) filler
      3,        // R -> (2,3)  -> completes (5,0)(4,1)(3,2)(2,3)
    ];
    const s = play(seq);
    expect(s.status).toBe('win');
    expect(s.winner).toBe(0);
  });

  test('out-of-turn move throws', () => {
    const s = connect4.createInitialState();
    expect(() => connect4.applyMove(s, { type: 'place', cell: 0 }, 1)).toThrow(/turn/);
  });

  test('move after game finished throws', () => {
    const s = play([0, 1, 0, 1, 0, 1, 0]); // R wins vertical col 0
    expect(s.status).toBe('win');
    expect(() => connect4.applyMove(s, { type: 'place', cell: 2 }, 1)).toThrow(/finished/);
  });
});

describe('connect4 — immutability', () => {
  test('applyMove does not mutate input state', () => {
    const s = connect4.createInitialState();
    const snapshot = JSON.stringify(s);
    connect4.applyMove(s, { type: 'place', cell: 3 }, 0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('connect4 — legal moves', () => {
  test('initial state has 7 legal columns for slot 0, none for slot 1', () => {
    const s = connect4.createInitialState();
    expect(connect4.getLegalMoves(s, 0).length).toBe(7);
    expect(connect4.getLegalMoves(s, 1).length).toBe(0);
  });

  test('full column drops out of legal moves', () => {
    const s = play([0, 0, 0, 0, 0, 0]); // col 0 full
    const moves = connect4.getLegalMoves(s, s.turn);
    expect(moves.find((m) => m.cell === 0)).toBeUndefined();
    expect(moves.length).toBe(6);
  });
});

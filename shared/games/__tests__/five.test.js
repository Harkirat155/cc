import five from '../five.js';
import { assertGameRules } from '../rules.js';

const N = 15;
const idx = (r, c) => r * N + c;

function deepFreeze(o) {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(o);
}

// Place `cells` for slot 0 and `others` for slot 1, alternating, slot 0 first.
function play(cells, others) {
  let state = five.createInitialState();
  for (let i = 0; i < cells.length; i++) {
    ({ state } = five.applyMove(state, { type: 'place', cell: cells[i] }, 0));
    if (state.status !== 'active') break;
    if (i < others.length) ({ state } = five.applyMove(state, { type: 'place', cell: others[i] }, 1));
  }
  return state;
}

// Quiet filler cells for slot 1 far from the action (bottom rows, spaced out).
const FILL = [idx(14, 0), idx(14, 2), idx(14, 4), idx(14, 6), idx(14, 8), idx(14, 10), idx(14, 12)];

describe('five — contract', () => {
  test('satisfies GameRules contract', () => {
    expect(() => assertGameRules(five)).not.toThrow();
  });

  test('initial state: 15x15 empty, turn 0, active', () => {
    const s = five.createInitialState();
    expect(five.boardSpec).toEqual({ kind: 'grid', rows: 15, cols: 15 });
    expect(s.board).toHaveLength(225);
    expect(s.board.every((c) => c === '')).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.status).toBe('active');
    expect(s.scores).toEqual([0, 0]);
  });

  test('legal moves are all empty cells, only for the player to move', () => {
    const s = play([idx(7, 7)], []);
    const moves = five.getLegalMoves(s, 1);
    expect(moves).toHaveLength(224);
    expect(moves.some((m) => m.cell === idx(7, 7))).toBe(false);
    expect(five.getLegalMoves(s, 0)).toEqual([]);
  });
});

describe('five — wins', () => {
  const cases = {
    horizontal: [0, 1, 2, 3, 4].map((k) => idx(5, 3 + k)),
    vertical: [0, 1, 2, 3, 4].map((k) => idx(2 + k, 6)),
    'diagonal down-right': [0, 1, 2, 3, 4].map((k) => idx(3 + k, 3 + k)),
    'diagonal down-left': [0, 1, 2, 3, 4].map((k) => idx(3 + k, 10 - k)),
  };
  for (const [name, cells] of Object.entries(cases)) {
    test(`${name} five wins and reports the cells`, () => {
      const s = play(cells, FILL);
      expect(s.status).toBe('win');
      expect(s.winner).toBe(0);
      expect([...s.winningCells].sort((a, b) => a - b)).toEqual([...cells].sort((a, b) => a - b));
      expect(s.scores).toEqual([1, 0]);
    });
  }

  test('six in a row also wins (made by joining two groups)', () => {
    const cells = [0, 1, 3, 4, 5, 2].map((k) => idx(5, k));
    const s = play(cells, FILL);
    expect(s.status).toBe('win');
    expect(s.winningCells).toHaveLength(6);
  });

  test('four in a row is not a win', () => {
    const s = play([0, 1, 2, 3].map((k) => idx(5, k)), FILL);
    expect(s.status).toBe('active');
    expect(s.winningCells).toEqual([]);
  });

  test('second player can win', () => {
    let s = five.createInitialState();
    const p0 = [idx(0, 0), idx(0, 2), idx(0, 4), idx(0, 6), idx(0, 8)];
    const p1 = [0, 1, 2, 3, 4].map((k) => idx(10, k));
    for (let i = 0; i < 5; i++) {
      ({ state: s } = five.applyMove(s, { type: 'place', cell: p0[i] }, 0));
      ({ state: s } = five.applyMove(s, { type: 'place', cell: p1[i] }, 1));
    }
    expect(s.status).toBe('win');
    expect(s.winner).toBe(1);
  });

  test('full board with no five is a draw', () => {
    // Stripe pattern: no run longer than 2 in any direction.
    const label = (r, c) => ((c + 2 * r) % 4 < 2 ? 'B' : 'G');
    const board = Array.from({ length: 225 }, (_, i) => label(Math.floor(i / N), i % N));
    const last = 224;
    const wanted = board[last];
    board[last] = '';
    const slot = wanted === 'B' ? 0 : 1;
    const nearlyFull = { ...five.createInitialState(), board, turn: slot, moveCount: 224 };
    expect(five.checkTerminal(nearlyFull).status).toBe('active');
    const { state } = five.applyMove(nearlyFull, { type: 'place', cell: last }, slot);
    expect(state.status).toBe('draw');
    expect(state.winner).toBeNull();
  });
});

describe('five — move validation', () => {
  test('applyMove does not mutate its input', () => {
    const s = deepFreeze(five.createInitialState());
    const { state, events } = five.applyMove(s, { type: 'place', cell: idx(7, 7) }, 0);
    expect(state.board[idx(7, 7)]).not.toBe('');
    expect(state.turn).toBe(1);
    expect(s.board[idx(7, 7)]).toBe('');
    expect(events[0].affectedCells).toEqual([idx(7, 7)]);
  });

  test('occupied cell, wrong turn, out of range and finished game are rejected', () => {
    const s = play([idx(7, 7)], []);
    expect(() => five.applyMove(s, { type: 'place', cell: idx(7, 7) }, 1)).toThrow();
    expect(() => five.applyMove(s, { type: 'place', cell: idx(0, 0) }, 0)).toThrow(/turn/);
    expect(() => five.applyMove(s, { type: 'place', cell: 225 }, 1)).toThrow();
    const won = play([0, 1, 2, 3, 4].map((k) => idx(5, k)), FILL);
    expect(() => five.applyMove(won, { type: 'place', cell: idx(9, 9) }, 1)).toThrow();
  });
});

describe('five — evaluate', () => {
  test('open four outscores open three, and is signed by slot', () => {
    const three = { ...five.createInitialState(), board: Array(225).fill('') };
    [5, 6, 7].forEach((c) => { three.board[idx(7, c)] = 'B'; });
    const four = { ...five.createInitialState(), board: Array(225).fill('') };
    [5, 6, 7, 8].forEach((c) => { four.board[idx(7, c)] = 'B'; });
    expect(five.evaluate(four, 0)).toBeGreaterThan(five.evaluate(three, 0));
    expect(five.evaluate(three, 0)).toBeGreaterThan(0);
    expect(five.evaluate(three, 1)).toBeLessThan(0);
  });
});

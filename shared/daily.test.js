import connect4 from './games/connect4.js';
import { canWin, keepsWin, defenderReply, puzzleForDate } from './daily.js';

const play = (cols) => {
  let state = connect4.createInitialState();
  let slot = 0;
  for (const col of cols) {
    ({ state } = connect4.applyMove(state, { type: 'place', cell: col }, slot));
    slot = 1 - slot;
  }
  return state.board;
};

// Red holds bottom c2,c3 with Yellow stacked on both, Red to move: R c4 makes an open three.
const OPEN_TWO = () => play([2, 2, 3, 3]);

describe('daily solver', () => {
  test('finds a known forced win in 2 and not in 1', () => {
    expect(canWin(OPEN_TWO(), 0, 1)).toBe(false);
    expect(canWin(OPEN_TWO(), 0, 2)).toBe(true);
  });

  test('finds an immediate win', () => {
    expect(canWin(play([0, 0, 1, 1, 2, 2]), 0, 1)).toBe(true);
  });

  test('empty board has no forced win in 2', () => {
    expect(canWin(connect4.createInitialState().board, 0, 2)).toBe(false);
  });

  test('keepsWin accepts the winning column and rejects a slip', () => {
    expect(keepsWin(OPEN_TWO(), 4, 0, 2)).toBe(true);
    expect(keepsWin(OPEN_TWO(), 6, 0, 2)).toBe(false);
  });

  test('the defender takes a win when it has one', () => {
    // Yellow has three stacked in column 0; the defender (Yellow, slot 1) plays column 0 to win.
    const b = play([1, 0, 2, 0, 3, 0, 6]);
    expect(defenderReply(b, 0, 1)).toBe(0);
  });
});

describe('solver edge cases', () => {
  test('n below 1 never wins, even with an immediate win on the board', () => {
    expect(canWin(play([0, 0, 1, 1, 2, 2]), 0, 0)).toBe(false);
  });

  test('Yellow to move: worked by hand', () => {
    // R c0, Y c2, R c0, Y c3, R c6 -> Yellow to move holding bottom c2,c3.
    // Yellow c4 makes an open three on the bottom row (c1 and c5 both playable);
    // Red has no four to make, so Yellow wins on its second move, not its first.
    const b = play([0, 2, 0, 3, 6]);
    expect(canWin(b, 1, 1)).toBe(false);
    expect(canWin(b, 1, 2)).toBe(true);
    expect(keepsWin(b, 4, 1, 2)).toBe(true);
    expect(keepsWin(b, 5, 1, 2)).toBe(false);
  });

  test('a full board has no forced win', () => {
    const board = Array.from({ length: 42 }, (_, i) => (((i % 7) + Math.floor(Math.floor(i / 7) / 2)) % 2 ? 'R' : 'Y'));
    expect(connect4.checkTerminal({ board }).status).toBe('draw');
    expect(canWin(board, 0, 3)).toBe(false);
    expect(keepsWin(board, 0, 0, 2)).toBe(false);
  });
});

describe('puzzleForDate', () => {
  test('is deterministic for a date and differs across dates', () => {
    expect(puzzleForDate('2026-11-28')).toEqual(puzzleForDate('2026-11-28'));
    const boards = new Set(['2026-11-28', '2026-11-29', '2026-11-30'].map((d) => puzzleForDate(d).board.join('')));
    expect(boards.size).toBeGreaterThan(1);
  });

  test('returns a position with a forced win in exactly N and none faster', () => {
    for (const date of ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03']) {
      const p = puzzleForDate(date);
      expect([2, 3]).toContain(p.n);
      expect(canWin(p.board, p.turn, p.n)).toBe(true);
      expect(canWin(p.board, p.turn, p.n - 1)).toBe(false);
      expect(connect4.checkTerminal({ board: p.board }).status).toBe('active');
    }
  });

  test('covers both N = 2 and N = 3 across a month', () => {
    const ns = new Set();
    for (let d = 1; d <= 30; d++) ns.add(puzzleForDate(`2026-12-${String(d).padStart(2, '0')}`).n);
    expect([...ns].sort()).toEqual([2, 3]);
  });
});

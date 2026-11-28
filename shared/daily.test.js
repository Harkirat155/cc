import connect4 from './games/connect4.js';
import ttt from './games/ttt.js';
import five from './games/five.js';
import { canWin, keepsWin, defenderReply, puzzleForDate, solutionLine, gameForDate, tttPuzzleForDate, tttWinningCells, fivePuzzleForDate, fiveWinningCells, FIVE_WINDOW, CHECKERS_FROM, checkersPuzzleForDate, checkersCanWin, checkersMoves, checkersPlay, checkersSolutionLine } from './daily.js';
import checkers from './games/checkers.js';

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

describe('solutionLine', () => {
  test.each(['2026-11-27', '2026-11-28', '2026-11-29', '2026-12-01', '2026-12-05'])('%s: a legal line that ends in a win within n of the attacker moves', (date) => {
    const puzzle = puzzleForDate(date);
    const line = solutionLine(puzzle);
    let state = { ...connect4.createInitialState(), board: puzzle.board.slice(), turn: puzzle.turn };
    let mine = 0;
    let status = 'active';
    line.forEach(({ col, mark }, i) => {
      const slot = mark === 'R' ? 0 : 1;
      expect(slot).toBe(i % 2 === 0 ? puzzle.turn : 1 - puzzle.turn);
      if (slot === puzzle.turn) mine++;
      ({ state } = connect4.applyMove(state, { type: 'place', cell: col }, slot));
      status = connect4.checkTerminal(state).status;
    });
    expect(status).toBe('win');
    expect(connect4.checkTerminal(state).winnerSlot ?? puzzle.turn).toBe(puzzle.turn);
    expect(mine).toBeLessThanOrEqual(puzzle.n);
  });
});

describe('daily game by date', () => {
  const days = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 10, 27 + i)).toISOString().slice(0, 10));

  test('is decided by the date alone, with Connect Four on the launch days and Tic-Tac-Toe on a fixed subset', () => {
    expect(gameForDate('2026-11-27')).toBe('connect4');
    expect(gameForDate('2026-11-28')).toBe('connect4');
    expect(gameForDate('2026-11-30')).toBe('ttt');
    expect(days.map(gameForDate)).toEqual(days.map(gameForDate));
    const ttt = days.filter((d) => gameForDate(d) === 'ttt').length;
    expect(ttt).toBeGreaterThanOrEqual(8);
    expect(ttt).toBeLessThanOrEqual(12);
  });

  test('every Tic-Tac-Toe day has a stable, solvable one-move puzzle, of both kinds across the month', () => {
    const kinds = new Set();
    for (const d of days.filter((x) => gameForDate(x) === 'ttt')) {
      const p = tttPuzzleForDate(d);
      expect(tttPuzzleForDate(d)).toEqual(p);
      kinds.add(p.kind);
      const me = ['X', 'O'][p.turn];
      expect(p.board.filter((v) => v === 'X').length - p.board.filter((v) => v === 'O').length).toBe(p.turn === 0 ? 0 : 1);
      expect(ttt.checkTerminal({ board: p.board }).status).toBe('active');
      expect(p.answers.length).toBeGreaterThan(0);
      for (const cell of p.answers) {
        expect(p.board[cell]).toBe('');
        const b = p.board.slice();
        b[cell] = me;
        if (p.kind === 'win') expect(ttt.checkTerminal({ board: b }).winner).toBe(p.turn);
      }
      if (p.kind === 'block') {
        expect(tttWinningCells(p.board, me)).toEqual([]);
        expect(p.answers).toEqual(tttWinningCells(p.board, ['O', 'X'][p.turn]));
        expect(p.answers).toHaveLength(1);
      }
    }
    expect([...kinds].sort()).toEqual(['block', 'win']);
  });
});

describe('Five in a Row day', () => {
  const span = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 10, 27 + i)).toISOString().slice(0, 10));
  const fiveDays = span.filter((d) => gameForDate(d) === 'five');

  test('every fourth UTC day from 2026-12-02 is Five in a Row; every earlier day keeps its game', () => {
    expect(gameForDate('2026-11-27')).toBe('connect4');
    expect(gameForDate('2026-11-28')).toBe('connect4'); // day number % 4 === 1 but already live before the Five day shipped
    expect(gameForDate('2026-11-30')).toBe('ttt');
    expect(gameForDate('2026-12-01')).toBe('connect4');
    expect(gameForDate('2026-12-02')).toBe('five');
    expect(gameForDate('2026-12-03')).toBe('connect4');
    expect(gameForDate('2026-12-04')).toBe('ttt');
    expect(gameForDate('2026-12-06')).toBe('five');
    expect(fiveDays.every((d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000) % 4 === 1)).toBe(true);
    expect(fiveDays).toHaveLength(99);
    // Tic-Tac-Toe days (n % 4 === 3) are untouched by the new rule.
    expect(span.filter((d) => gameForDate(d) === 'ttt')).toHaveLength(100);
  });

  test('the puzzle is stable and has exactly one winning cell for the side to move', () => {
    for (const d of fiveDays) {
      const p = fivePuzzleForDate(d);
      expect(fivePuzzleForDate(d)).toEqual(p);
      const me = ['B', 'G'][p.turn];
      const them = ['B', 'G'][1 - p.turn];
      const b = p.board.filter((v) => v === 'B').length;
      const g = p.board.filter((v) => v === 'G').length;
      expect(b - g).toBe(p.turn === 0 ? 0 : 1);
      expect(five.checkTerminal({ board: p.board }).status).toBe('active');
      expect(fiveWinningCells(p.board, me)).toEqual(p.answers);
      expect(p.answers).toHaveLength(1);
      expect(fiveWinningCells(p.board, them)).toEqual([]);
      // the same verdict through the shared rules
      const next = p.board.slice();
      next[p.answers[0]] = me;
      expect(five.checkTerminal({ board: next }).winner).toBe(p.turn);
      for (let i = 0; i < p.board.length; i++) {
        if (p.board[i] !== '' || i === p.answers[0]) continue;
        const alt = p.board.slice();
        alt[i] = me;
        expect(five.checkTerminal({ board: alt }).status).toBe('active');
      }
      // every stone and the answer sit inside the shown window, so the crop loses nothing
      p.board.forEach((v, i) => {
        if (!v && i !== p.answers[0]) return;
        const r = Math.floor(i / 15) - FIVE_WINDOW.top;
        const c = (i % 15) - FIVE_WINDOW.left;
        expect(r >= 0 && r < FIVE_WINDOW.size && c >= 0 && c < FIVE_WINDOW.size).toBe(true);
      });
    }
  });
});

describe('checkers days', () => {
  const day = (i) => new Date(Date.parse(`${CHECKERS_FROM}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
  const span = Array.from({ length: 60 }, (_, i) => day(i));
  const checkersDays = Array.from({ length: 60 }, (_, i) => day(i * 4)); // day number % 4 === 2 from the start date

  test('the rotation starts on CHECKERS_FROM and every day before keeps the game it always had', () => {
    expect(gameForDate(CHECKERS_FROM)).toBe('checkers');
    expect(gameForDate('2026-12-03')).toBe('connect4'); // day number % 4 === 2, but before the start
    // The rule before the Checkers rotation (Tic-Tac-Toe, Five in a Row, Connect Four), written out by day number.
    const before = (d) => { const n = Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000) % 4; return n === 3 ? 'ttt' : n === 1 && d >= '2026-11-29' ? 'five' : 'connect4'; };
    for (let t = Date.parse('2026-11-27T00:00:00Z'); t < Date.parse(`${CHECKERS_FROM}T00:00:00Z`); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      expect(gameForDate(d)).toBe(before(d));
    }
    // From the start date only the days that were Connect Four on the old rule and are day % 4 === 2 changed.
    for (const d of span) {
      const n = Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000) % 4;
      expect(gameForDate(d)).toBe(n === 2 ? 'checkers' : before(d));
    }
    expect(span.filter((d) => gameForDate(d) === 'checkers')).toHaveLength(15);
  });

  test('60 consecutive Checkers days each have a stable puzzle that is a forced win in exactly n, quickly', () => {
    const ns = new Set();
    for (const d of checkersDays) {
      expect(gameForDate(d)).toBe('checkers');
      const t0 = Date.now();
      const p = checkersPuzzleForDate(d);
      expect(Date.now() - t0).toBeLessThan(200);
      expect(checkersPuzzleForDate(d)).toEqual(p);
      ns.add(p.n);
      expect([2, 3]).toContain(p.n);
      expect(checkers.checkTerminal({ board: p.board, status: 'active' }).status).toBe('active');
      expect(checkersCanWin(p.board, p.turn, p.n)).toBe(true);
      expect(checkersCanWin(p.board, p.turn, p.n - 1)).toBe(false);
    }
    expect(ns).toEqual(new Set([2, 3]));
  });

  test('the solution line wins within n against its own best defence, through the checkers rules module', () => {
    for (const d of checkersDays.slice(0, 20)) {
      const p = checkersPuzzleForDate(d);
      let state = { board: p.board, turn: p.turn, status: 'active', winner: null, winningCells: [], scores: [0, 0], moveCount: 0 };
      let mine = 0;
      for (const { move, turn } of checkersSolutionLine(p)) {
        expect(state.turn).toBe(turn);
        state = checkers.applyMove(state, move, turn).state;
        if (turn === p.turn) mine++;
      }
      expect(state.status).toBe('win');
      expect(state.winner).toBe(p.turn);
      expect(mine).toBeLessThanOrEqual(p.n);
    }
  });

  test('a position checked by hand: a lone Red man at row 5 col 2 chases a lone Amber man at row 2 col 1 (0-based)', () => {
    // Red (slot 0, moves up) man on 33 = (4,1); Amber (slot 1, moves down) man on 8 = (1,0). Red to move.
    // Amber's only move is (1,0)->(2,1). Red plays (4,1)->(3,2) or (3,0); either way Amber must step to (2,1),
    // which Red then jumps (to (1,0) or (1,2)), taking the last piece: a win in 2, not in 1 (no piece is adjacent now).
    const board = Array(64).fill('');
    board[33] = { type: 'man', owner: 0 };
    board[8] = { type: 'man', owner: 1 };
    expect(checkersCanWin(board, 0, 1)).toBe(false);
    expect(checkersCanWin(board, 0, 2)).toBe(true);
    const moves = checkersMoves(board, 0);
    expect(moves.map((m) => `${m.from}>${m.to}`).sort()).toEqual(['33>24', '33>26']);
    expect(checkersMoves(board, 1).map((m) => `${m.from}>${m.to}`)).toEqual(['8>17']);
    const first = checkersPlay(board, 0, moves.find((m) => m.to === 26), 2);
    expect(first.kept).toBe(true);
    const reply = checkersMoves(first.board, 1)[0];
    expect(reply).toEqual({ type: 'transfer', from: 8, to: 17 });
    const after = checkersPlay(first.board, 1, reply, 0).board;
    const jump = checkersMoves(after, 0).find((m) => m.captures);
    expect(jump).toEqual({ type: 'transfer', from: 26, to: 8, captures: [17] });
    expect(checkersPlay(after, 0, jump, 1).won).toBe(true);
  });
});

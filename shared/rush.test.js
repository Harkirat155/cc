import { RUSH_SECONDS, rushGame, rushPuzzle, rushStep, rushSolve } from './rush.js';

const DAY = '2026-11-28';

describe('puzzle rush sequence', () => {
  it('is three minutes and the games rotate from an easy Tic-Tac-Toe opener', () => {
    expect(RUSH_SECONDS).toBe(180);
    expect([0, 1, 2, 3, 4].map((k) => rushGame(DAY, k))).toEqual(['ttt', 'connect4', 'five', 'checkers', 'ttt']);
  });

  it('is the same for everyone on a day and differs between days', () => {
    expect(rushPuzzle(DAY, 1)).toEqual(rushPuzzle(DAY, 1));
    expect(rushPuzzle(DAY, 1).board).not.toEqual(rushPuzzle('2026-11-29', 1).board);
    expect(rushPuzzle(DAY, 1).board).not.toEqual(rushPuzzle(DAY, 5).board);
  });

  it('every puzzle of the first 12 slots is solved by its own solution line and a slip is caught', () => {
    for (let k = 0; k < 12; k++) {
      const p = rushPuzzle(DAY, k);
      expect(p.game).toBe(rushGame(DAY, k));
      let s = { board: p.board, left: p.n };
      let r;
      for (const move of rushSolve(p)) { r = rushStep(p, s, move); s = r; if (r.result !== 'continue') break; }
      expect(r.result).toBe('solved');
    }
  });

  it('a wrong one-move answer slips', () => {
    const p = rushPuzzle(DAY, 0);
    const wrong = p.board.findIndex((v, i) => v === '' && !p.answers.includes(i));
    expect(rushStep(p, { board: p.board, left: 1 }, wrong).result).toBe('slipped');
  });
});

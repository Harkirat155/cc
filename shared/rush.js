import connect4 from './games/connect4.js';
import {
  checkersDefenderReply, checkersPlay, checkersPuzzleForDate, checkersSolutionLine, defenderReply, fivePuzzleForDate,
  keepsWin, puzzleForDate, solutionLine, tttPuzzleForDate,
} from './daily.js';

// Puzzle Rush: a 3 minute run of daily-style puzzles. Slot k of a UTC day is puzzle `rush-{day}-{k}` of the game
// GAMES[k % 4], built by the daily's own generators (they seed from any string, so the run is the same for everyone
// and never repeats a served daily). Wrong-move rule: a move that lets the win slip ends that puzzle at once (the
// page moves on to the next); there is no retry. Rules and searches stay in daily.js and shared/games/.
export const RUSH_SECONDS = 180;
const GAMES = ['ttt', 'connect4', 'five', 'checkers'];
const MARKS = { ttt: ['X', 'O'], connect4: ['R', 'Y'], five: ['B', 'G'] };
export const rushGame = (day, k) => GAMES[k % 4];

export function rushPuzzle(day, k) {
  const game = rushGame(day, k);
  const seed = `rush-${day}-${k}`;
  const make = { ttt: tttPuzzleForDate, connect4: puzzleForDate, five: fivePuzzleForDate, checkers: checkersPuzzleForDate }[game];
  return { ...make(seed), game };
}

const dropC4 = (board, col, mark) => {
  const next = board.slice();
  next[[5, 4, 3, 2, 1, 0].find((r) => next[r * 7 + col] === '') * 7 + col] = mark;
  return next;
};

/**
 * Plays `move` (a cell, a column, or for Checkers a move object) on `state` {board, left}.
 * Returns {board, left, result}: 'solved' (win reached), 'slipped' (win no longer forced: puzzle over) or 'continue'.
 */
export function rushStep(p, state, move) {
  const { board, left } = state;
  const marks = MARKS[p.game];
  if (p.game === 'checkers') {
    const r = checkersPlay(board, p.turn, move, left);
    if (r.won) return { board: r.board, left, result: 'solved' };
    const reply = checkersDefenderReply(r.board, p.turn, left - 1);
    const answered = checkersPlay(r.board, 1 - p.turn, reply, 0);
    const over = !r.kept || left < 2 || answered.won;
    return { board: answered.board, left: left - 1, result: over ? 'slipped' : 'continue' };
  }
  if (p.game !== 'connect4') {
    const solves = p.answers.includes(move);
    return { board: board.map((v, i) => (i === move ? marks[p.turn] : v)), left, result: solves ? 'solved' : 'slipped' };
  }
  const kept = keepsWin(board, move, p.turn, left);
  let next = dropC4(board, move, marks[p.turn]);
  if (connect4.checkTerminal({ board: next }).status === 'win') return { board: next, left, result: 'solved' };
  next = dropC4(next, defenderReply(next, p.turn, left - 1), marks[1 - p.turn]);
  const over = !kept || left < 2 || connect4.checkTerminal({ board: next }).status !== 'active';
  return { board: next, left: left - 1, result: over ? 'slipped' : 'continue' };
}

/** The attacker's moves of one winning line, in the form rushStep takes. */
export function rushSolve(p) {
  if (p.game === 'checkers') return checkersSolutionLine(p).filter((m) => m.turn === p.turn).map((m) => m.move);
  if (p.game === 'connect4') return solutionLine(p).filter((m) => m.mark === MARKS.connect4[p.turn]).map((m) => m.col);
  return [p.answers[0]];
}

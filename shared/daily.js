// Daily Connect Four puzzle: a small exact solver plus a date-seeded generator.
// Pure functions over the connect4 board (42 cells, row-major, '' | 'R' | 'Y').
// "Win in N" means the side to move forces a win using at most N of its own moves.

const ROWS = 6;
const COLS = 7;
const MARKS = ['R', 'Y'];
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const MAX_ATTEMPTS = 20000;

/** Drops `mark` in `col` (mutates); returns the cell, or -1 when the column is full. */
function drop(b, col, mark) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r * COLS + col] === '') { b[r * COLS + col] = mark; return r * COLS + col; }
  }
  return -1;
}

function makesFour(b, cell, mark) {
  const r0 = Math.floor(cell / COLS);
  const c0 = cell % COLS;
  for (const [dr, dc] of DIRS) {
    let n = 1;
    for (const s of [1, -1]) {
      for (let k = 1; k < 4; k++) {
        const r = r0 + dr * k * s;
        const c = c0 + dc * k * s;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || b[r * COLS + c] !== mark) break;
        n++;
      }
    }
    if (n >= 4) return true;
  }
  return false;
}

// `me` (to move) wins within n of its own moves.
function attack(b, me, n) {
  const mark = MARKS[me];
  for (const col of ORDER) {
    const cell = drop(b, col, mark);
    if (cell < 0) continue;
    const won = makesFour(b, cell, mark);
    b[cell] = '';
    if (won) return true;
  }
  if (n < 2) return false;
  for (const col of ORDER) {
    const cell = drop(b, col, mark);
    if (cell < 0) continue;
    const ok = forcedAfter(b, me, n - 1);
    b[cell] = '';
    if (ok) return true;
  }
  return false;
}

// The opponent of `me` is to move; every reply must still lose to `me` within n more moves.
function forcedAfter(b, me, n) {
  const opp = MARKS[1 - me];
  let any = false;
  for (const col of ORDER) {
    const cell = drop(b, col, opp);
    if (cell < 0) continue;
    any = true;
    const loses = !makesFour(b, cell, opp) && attack(b, me, n);
    b[cell] = '';
    if (!loses) return false;
  }
  return any;
}

/** Side `turn` (0|1) to move can force a win within n of its own moves. */
export const canWin = (board, turn, n) => n >= 1 && attack(board.slice(), turn, n);

/** After `turn` drops in `col`, is the win still forced within n moves (this one included)? */
export function keepsWin(board, col, turn, n) {
  const b = board.slice();
  const cell = drop(b, col, MARKS[turn]);
  if (cell < 0) return false;
  if (makesFour(b, cell, MARKS[turn])) return true;
  return n > 1 && forcedAfter(b, turn, n - 1);
}

/**
 * Best defence for the opponent of `attacker`, who still needs up to `left` moves after this reply:
 * win if possible, else slip out of the forced win, else resist as long as possible.
 */
export function defenderReply(board, attacker, left) {
  const def = MARKS[1 - attacker];
  let best = -1;
  let bestScore = -1;
  for (const col of ORDER) {
    const b = board.slice();
    const cell = drop(b, col, def);
    if (cell < 0) continue;
    if (makesFour(b, cell, def)) return col;
    let score = left + 1; // escaped
    for (let k = 1; k <= left; k++) {
      if (attack(b, attacker, k)) { score = k; break; }
    }
    if (score > bestScore) { best = col; bestScore = score; }
  }
  return best;
}

/** One winning line from the puzzle position: [{col, mark}] with the attacker's moves and the defender's best replies. */
export function solutionLine(puzzle) {
  const b = puzzle.board.slice();
  const line = [];
  let left = puzzle.n;
  while (left >= 1) {
    const col = ORDER.find((c) => b[c] === '' && keepsWin(b, c, puzzle.turn, left));
    if (col === undefined) break;
    const cell = drop(b, col, MARKS[puzzle.turn]);
    line.push({ col, mark: MARKS[puzzle.turn] });
    if (makesFour(b, cell, MARKS[puzzle.turn])) break;
    const reply = defenderReply(b, puzzle.turn, left - 1);
    if (reply < 0) break; // board full: no reply to show
    drop(b, reply, MARKS[1 - puzzle.turn]);
    line.push({ col: reply, mark: MARKS[1 - puzzle.turn] });
    left -= 1;
  }
  return line;
}

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

function seedFrom(text) { // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same position for everyone on a date: random legal plies kept only when the win is in exactly N. */
export function puzzleForDate(date) {
  const rng = mulberry32(seedFrom(date));
  const n = rng() < 0.5 ? 2 : 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = Array(ROWS * COLS).fill('');
    const plies = 6 + Math.floor(rng() * 14);
    let turn = 0;
    let dead = false;
    for (let i = 0; i < plies && !dead; i++) {
      const open = [0, 1, 2, 3, 4, 5, 6].filter((c) => board[c] === '');
      if (!open.length) { dead = true; break; }
      const cell = drop(board, open[Math.floor(rng() * open.length)], MARKS[turn]);
      if (makesFour(board, cell, MARKS[turn])) dead = true;
      turn = 1 - turn;
    }
    if (dead) continue;
    if (!canWin(board, turn, n - 1) && canWin(board, turn, n)) return { date, n, board, turn };
  }
  throw new Error(`no puzzle found for ${date}`);
}

// Which game a date's puzzle is, from the UTC date alone so everyone agrees and a past day never changes:
// every fourth UTC day (day number % 4 === 3) is Tic-Tac-Toe, the rest Connect Four. The Worker's /d card uses the same rule.
export const GAME_NAMES = { connect4: 'Connect Four', ttt: 'Tic-Tac-Toe' };
export const gameForDate = (date) => (Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % 4 === 3 ? 'ttt' : 'connect4');

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const TTT_MARKS = ['X', 'O'];

/** Empty cells where `mark` completes a line. */
export const tttWinningCells = (board, mark) =>
  board.flatMap((v, i) => (v === '' && TTT_LINES.some((l) => l.includes(i) && l.every((c) => c === i || board[c] === mark)) ? [i] : []));

/**
 * Tic-Tac-Toe puzzle for a date: a live position where the side to move either wins now (kind 'win') or must block the
 * opponent's only threat (kind 'block'). `answers` are the cells that solve it; `n` is 1 (one move).
 */
export function tttPuzzleForDate(date) {
  const rng = mulberry32(seedFrom(`${date}:ttt`));
  const kind = rng() < 0.5 ? 'win' : 'block';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = Array(9).fill('');
    const plies = 3 + Math.floor(rng() * 4);
    let turn = 0;
    let dead = false;
    for (let i = 0; i < plies && !dead; i++) {
      const open = board.flatMap((v, c) => (v === '' ? [c] : []));
      board[open[Math.floor(rng() * open.length)]] = TTT_MARKS[turn];
      dead = TTT_LINES.some((l) => l.every((c) => board[c] === TTT_MARKS[turn]));
      turn = 1 - turn;
    }
    if (dead) continue;
    const mine = tttWinningCells(board, TTT_MARKS[turn]);
    const theirs = tttWinningCells(board, TTT_MARKS[1 - turn]);
    if (kind === 'win' && mine.length) return { date, game: 'ttt', kind, n: 1, board, turn, answers: mine };
    if (kind === 'block' && !mine.length && theirs.length === 1) return { date, game: 'ttt', kind, n: 1, board, turn, answers: theirs };
  }
  throw new Error(`no tic-tac-toe puzzle found for ${date}`);
}

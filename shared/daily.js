import five from './games/five.js';
import checkers from './games/checkers.js';

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
// every fourth UTC day (day number % 4 === 3) is Tic-Tac-Toe; from FIVE_FROM on, day number % 4 === 1 is Five in a Row;
// the rest are Connect Four. FIVE_FROM is the day after the one live when Five in a Row shipped, so no served puzzle changes.
// The Worker's /d card uses the same rule.
// CHECKERS_FROM starts the next rotation: from then on day number % 4 === 2 is Checkers, so no served puzzle changes.
export const GAME_NAMES = { connect4: 'Connect Four', ttt: 'Tic-Tac-Toe', five: 'Five in a Row', checkers: 'Checkers' };
const FIVE_FROM = '2026-11-29';
export const CHECKERS_FROM = '2026-12-03';
export const gameForDate = (date) => {
  const n = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % 4;
  return n === 3 ? 'ttt' : n === 1 && date >= FIVE_FROM ? 'five' : n === 2 && date >= CHECKERS_FROM ? 'checkers' : 'connect4';
};

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

// Five in a Row: the board is the real 15x15 of shared/games/five.js, but every stone sits inside a 7x7 window of it
// (rows and columns 5 to 11) so the page can show big, tappable cells on a phone. Cells are full-board indices.
const FIVE_SIZE = 15;
const FIVE_MARKS = ['B', 'G'];
export const FIVE_WINDOW = { top: 4, left: 4, size: 7 };

/** Empty cells where `mark` completes a line of five or more (the rule of five.js). */
export function fiveWinningCells(board, mark) {
  const out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== '') continue;
    const r0 = Math.floor(i / FIVE_SIZE);
    const c0 = i % FIVE_SIZE;
    const wins = DIRS.some(([dr, dc]) => {
      let n = 1;
      for (const s of [1, -1]) {
        for (let k = 1; k < 5; k++) {
          const r = r0 + dr * k * s;
          const c = c0 + dc * k * s;
          if (r < 0 || r >= FIVE_SIZE || c < 0 || c >= FIVE_SIZE || board[r * FIVE_SIZE + c] !== mark) break;
          n++;
        }
      }
      return n >= 5;
    });
    if (wins) out.push(i);
  }
  return out;
}

/**
 * Five in a Row puzzle for a date: a legal position (alternating plies) where the side to move has exactly one cell that
 * makes five and the opponent has none, so the answer is unambiguous. `answers` holds that one cell; `n` is 1.
 * Built by planting four of the mover's stones in a line with a gap, scattering the rest, and keeping only positions that pass.
 */
export function fivePuzzleForDate(date) {
  const rng = mulberry32(seedFrom(`${date}:five`));
  const { top, left, size } = FIVE_WINDOW;
  const pick = (n) => Math.floor(rng() * n);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const turn = pick(2);
    const each = 4 + pick(5); // Green's stones, 4..8; Blue (first player) has the same, or one more when Green is to move
    const target = { B: each + turn, G: each };
    const board = Array(FIVE_SIZE * FIVE_SIZE).fill('');
    const [dr, dc] = DIRS[pick(DIRS.length)];
    const span = (d) => (d === 0 ? size : size - 4); // start offsets that keep all five cells inside the window
    const r0 = top + pick(span(dr));
    const c0 = left + (dc === -1 ? 4 : 0) + pick(span(dc));
    const gap = pick(5);
    const gapCell = (r0 + dr * gap) * FIVE_SIZE + c0 + dc * gap;
    const counts = { B: 0, G: 0 };
    for (let k = 0; k < 5; k++) {
      if (k === gap) continue;
      board[(r0 + dr * k) * FIVE_SIZE + c0 + dc * k] = FIVE_MARKS[turn];
      counts[FIVE_MARKS[turn]]++;
    }
    for (const m of FIVE_MARKS) {
      while (counts[m] < target[m]) {
        const cell = (top + pick(size)) * FIVE_SIZE + left + pick(size);
        if (board[cell] !== '' || cell === gapCell) continue;
        board[cell] = m;
        counts[m]++;
      }
    }
    if (fiveWinningCells(board, FIVE_MARKS[turn]).join() !== String(gapCell)) continue;
    if (fiveWinningCells(board, FIVE_MARKS[1 - turn]).length) continue;
    if (five.checkTerminal({ board }).status !== 'active') continue;
    return { date, game: 'five', n: 1, board, turn, answers: [gapCell], window: FIVE_WINDOW };
  }
  throw new Error(`no five-in-a-row puzzle found for ${date}`);
}

// Checkers: positions are states of shared/games/checkers.js and every search below goes through that module's own
// getLegalMoves and applyMove, so its rules (single jumps, captures not forced, no draws) are the rules of the puzzle.
// "Win in N" means the side to move wins within N of its own moves against every defence: the opponent has no piece
// or no legal move after one of them.
const CK_ATTEMPTS = 4000;
const ckState = (board, turn) => ({ board, turn, status: 'active', winner: null, winningCells: [], scores: [0, 0], moveCount: 0 });
const ckMoves = (s) => getCkMoves(s).sort((a, b) => (b.captures?.length || 0) - (a.captures?.length || 0)); // jumps first prunes sooner
const getCkMoves = (s) => checkers.getLegalMoves(s, s.turn);
const ckApply = (s, m) => checkers.applyMove(s, m, s.turn).state;

// `me` (to move in s) wins within n of its own moves.
function ckAttack(s, n) {
  const nexts = [];
  for (const m of ckMoves(s)) {
    const t = ckApply(s, m);
    if (t.status === 'win') return true;
    nexts.push(t);
  }
  return n >= 2 && nexts.some((t) => ckForced(t, s.turn, n - 1));
}

// The opponent of `me` is to move in s; every reply must still lose to `me` within n more moves.
function ckForced(s, me, n) {
  for (const m of ckMoves(s)) {
    const t = ckApply(s, m);
    if (t.status === 'win' || !ckAttack(t, n)) return false;
  }
  return true;
}

/** Side `turn` to move on `board` can force a win within n of its own moves. */
export const checkersCanWin = (board, turn, n) => n >= 1 && ckAttack(ckState(board, turn), n);

/** Legal moves of the side to move on `board`. */
export const checkersMoves = (board, turn) => getCkMoves(ckState(board, turn));

/** After `turn` plays `move`, is the win still forced within n moves (this one included)? Returns the new board and whether it won. */
export function checkersPlay(board, turn, move, n) {
  const t = ckApply(ckState(board, turn), move);
  return { board: t.board, won: t.status === 'win', kept: t.status === 'win' || (n > 1 && ckForced(t, turn, n - 1)) };
}

/** The opponent's best reply after the attacker's move (`left` more attacker moves allowed): win, else escape, else resist longest. */
export function checkersDefenderReply(board, attacker, left) {
  const s = ckState(board, 1 - attacker);
  let best = null;
  let bestScore = -1;
  for (const m of ckMoves(s)) {
    const t = ckApply(s, m);
    if (t.status === 'win') return m;
    let score = left + 1; // escaped
    for (let k = 1; k <= left; k++) if (ckAttack(t, k)) { score = k; break; }
    if (score > bestScore) { best = m; bestScore = score; }
  }
  return best;
}

/** One winning line: [{move, turn}] of the attacker's moves and the defender's best replies. */
export function checkersSolutionLine(puzzle) {
  let board = puzzle.board;
  const line = [];
  for (let left = puzzle.n; left >= 1; left--) {
    const pick = ckMoves(ckState(board, puzzle.turn)).map((m) => ({ m, r: checkersPlay(board, puzzle.turn, m, left) })).find((x) => x.r.kept);
    if (!pick) break;
    line.push({ move: pick.m, turn: puzzle.turn });
    board = pick.r.board;
    if (pick.r.won) break;
    const reply = checkersDefenderReply(board, puzzle.turn, left - 1);
    if (!reply) break;
    line.push({ move: reply, turn: 1 - puzzle.turn });
    board = ckApply(ckState(board, 1 - puzzle.turn), reply).board;
  }
  return line;
}

/**
 * Checkers puzzle for a date: a sparse position (2 or 3 men or kings for the mover, 1 or 2 for the defender) where the side to move wins in exactly n moves
 * (2 or 3) against any defence, found by random placement and kept only when the exhaustive search says so.
 */
export function checkersPuzzleForDate(date) {
  const rng = mulberry32(seedFrom(`${date}:checkers`));
  const n = rng() < 0.5 ? 2 : 3;
  const pick = (k) => Math.floor(rng() * k);
  for (let attempt = 0; attempt < CK_ATTEMPTS; attempt++) {
    const board = Array(64).fill('');
    const turn = pick(2);
    let anchor = null; // the defender is placed first; the mover's pieces start within 3 squares of one, so the sides can meet
    for (const owner of [1 - turn, turn]) {
      const count = owner === turn ? 2 + pick(2) : 1 + pick(2);
      for (let placed = 0; placed < count;) {
        const r = pick(8);
        const c = pick(8);
        const cell = r * 8 + c;
        if ((r + c) % 2 !== 1 || board[cell] !== '') continue;
        if (owner === turn && Math.max(Math.abs(r - anchor[0]), Math.abs(c - anchor[1])) > 3) continue;
        const king = rng() < 0.3;
        if (!king && r === (owner === 0 ? 0 : 7)) continue; // a man on its promotion row would already be a king
        board[cell] = { type: king ? 'king' : 'man', owner };
        if (!anchor) anchor = [r, c];
        placed++;
      }
    }
    if (!checkersMoves(board, turn).length || !checkersMoves(board, 1 - turn).length) continue;
    if (!checkersCanWin(board, turn, n - 1) && checkersCanWin(board, turn, n)) return { date, game: 'checkers', n, board, turn };
  }
  throw new Error(`no checkers puzzle found for ${date}`);
}

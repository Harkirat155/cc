import { chooseMove, LEVELS } from '../bot.js';
import ttt from '../../games/ttt.js';
import connect4 from '../../games/connect4.js';
import checkers from '../../games/checkers.js';
import five from '../../games/five.js';

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const step = (rules, state, move) => rules.applyMove(state, move, state.turn).state;

// Hard (as `botSlot`) must never lose against any opponent reply sequence.
function botNeverLoses(rules, state, botSlot) {
  if (state.status !== 'active') return state.winner !== (botSlot === 0 ? 1 : 0);
  if (state.turn === botSlot) {
    const move = chooseMove(rules, state, botSlot, 'hard', mulberry32(7));
    return botNeverLoses(rules, step(rules, state, move), botSlot);
  }
  return rules
    .getLegalMoves(state, state.turn)
    .every((m) => botNeverLoses(rules, step(rules, state, m), botSlot));
}

describe('hard ttt', () => {
  test.each([0, 1])('never loses from the start as slot %i against every reply', (slot) => {
    expect(botNeverLoses(ttt, ttt.createInitialState(), slot)).toBe(true);
  });
});

// Connect Four: place discs by column. cols alternate slot 0, 1, ...
function c4(cols) {
  return cols.reduce((s, col) => step(connect4, s, { type: 'place', cell: col }), connect4.createInitialState());
}

describe('connect4 tactics', () => {
  // Slot 0 has three in the bottom row (cols 0-2), slot 1 has three stacked in col 6. Slot 0 to move.
  const winFor0 = c4([0, 6, 1, 6, 2, 5]);
  // Slot 1 threatens col 3 on the bottom row; slot 0 (to move) must block.
  const blockFor0 = c4([6, 0, 6, 1, 5, 2]);

  test.each(LEVELS)('%s takes a one-move win', (level) => {
    const move = chooseMove(connect4, deepFreeze(winFor0), 0, level, mulberry32(3));
    const after = step(connect4, winFor0, move);
    expect(after.winner).toBe(0);
  });

  test.each(['medium', 'hard'])('%s blocks an immediate opponent win', (level) => {
    for (let seed = 1; seed <= 20; seed++) {
      const move = chooseMove(connect4, deepFreeze(blockFor0), 0, level, mulberry32(seed));
      expect(move).toEqual({ type: 'place', cell: 3 });
    }
  });
});

describe('checkers', () => {
  const legal = (state) => chooseMove(checkers, state, state.turn, 'hard');

  test.each(LEVELS)('%s returns a legal move from the initial state', (level) => {
    const s = checkers.createInitialState();
    const m = chooseMove(checkers, s, 0, level, mulberry32(5));
    expect(checkers.getLegalMoves(s, 0)).toContainEqual(m);
  });

  test('returns a legal move from a mid-game state', () => {
    let s = checkers.createInitialState();
    const rng = mulberry32(11);
    for (let i = 0; i < 12; i++) s = step(checkers, s, chooseMove(checkers, s, s.turn, 'easy', rng));
    expect(s.status).toBe('active');
    const m = legal(s);
    expect(checkers.getLegalMoves(s, s.turn)).toContainEqual(m);
  });

  test('returns null when the game is over', () => {
    expect(chooseMove(ttt, { ...ttt.createInitialState(), status: 'win', winner: 0 }, 1, 'hard')).toBeNull();
  });
});

describe('purity', () => {
  test.each([ttt, connect4, checkers])('does not mutate frozen input state ($id)', (rules) => {
    const s = deepFreeze(rules.createInitialState());
    for (const level of LEVELS) {
      expect(() => chooseMove(rules, s, 0, level, mulberry32(1))).not.toThrow();
    }
  });
});

describe('review fixes', () => {
  test('connect4 evaluate stays a number on a board holding four in a row', () => {
    let s = connect4.createInitialState();
    for (const col of [0, 6, 0, 6, 0, 6, 0]) s = step(connect4, s, { type: "place", cell: col });
    expect(Number.isFinite(connect4.evaluate(s, 0))).toBe(true);
  });

  test('five in a row: hard answers within a second and blocks an open four', () => {
    let s = five.createInitialState();
    const c = (r, col) => r * 15 + col;
    // Blue builds four in a row on row 7; Green plays far away.
    for (const [b, g] of [[c(7, 5), c(0, 0)], [c(7, 6), c(0, 2)], [c(7, 7), c(0, 4)], [c(7, 8), null]]) {
      s = step(five, s, five.getLegalMoves(s, s.turn).find((m) => m.cell === b));
      if (g !== null) s = step(five, s, five.getLegalMoves(s, s.turn).find((m) => m.cell === g));
    }
    const t0 = Date.now();
    const mv = chooseMove(five, deepFreeze(s), 1, 'hard', mulberry32(1));
    expect(Date.now() - t0).toBeLessThan(1000);
    expect([c(7, 4), c(7, 9)]).toContain(mv.cell);
  });

  test.each(LEVELS)('five in a row: %s replies next to the opening stone, not in a corner', (level) => {
    const s = step(five, five.createInitialState(), { type: 'place', cell: 7 * 15 + 7 });
    const mv = chooseMove(five, deepFreeze(s), 1, level, mulberry32(3));
    expect(Math.abs(Math.floor(mv.cell / 15) - 7)).toBeLessThanOrEqual(2);
    expect(Math.abs((mv.cell % 15) - 7)).toBeLessThanOrEqual(2);
  });
});

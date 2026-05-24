import ttt, { markToSlot, SLOT_TO_MARK } from '../ttt.js';
import { calcWinner } from '../../../server/gameLogic.js';

describe('shared/games/ttt — contract', () => {
  test('exposes required GameRules fields', () => {
    expect(ttt.id).toBe('ttt');
    expect(ttt.displayName).toBe('Tic-Tac-Toe');
    expect(ttt.players).toBe(2);
    expect(ttt.boardSpec).toEqual({ kind: 'grid', rows: 3, cols: 3 });
    expect(ttt.playerInfo).toHaveLength(2);
    expect(ttt.playerInfo[0].label).toBe('X');
    expect(ttt.playerInfo[1].label).toBe('O');
  });
});

describe('shared/games/ttt — initial state', () => {
  test('createInitialState returns canonical shape', () => {
    const s = ttt.createInitialState();
    expect(s.board).toEqual(Array(9).fill(''));
    expect(s.turn).toBe(0);
    expect(s.status).toBe('active');
    expect(s.winner).toBeNull();
    expect(s.winningCells).toEqual([]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.moveCount).toBe(0);
  });

  test('createInitialState returns independent instances', () => {
    const a = ttt.createInitialState();
    const b = ttt.createInitialState();
    a.board[0] = 'X';
    expect(b.board[0]).toBe('');
  });
});

describe('shared/games/ttt — legal moves', () => {
  test('returns all 9 cells on a fresh board', () => {
    const s = ttt.createInitialState();
    expect(ttt.getLegalMoves(s, 0)).toHaveLength(9);
  });

  test('returns no moves for the wrong slot', () => {
    const s = ttt.createInitialState();
    expect(ttt.getLegalMoves(s, 1)).toEqual([]);
  });

  test('returns no moves after game ends', () => {
    const s = ttt.createInitialState();
    let { state } = ttt.applyMove(s, { type: 'place', cell: 0 }, 0);
    ({ state } = ttt.applyMove(state, { type: 'place', cell: 3 }, 1));
    ({ state } = ttt.applyMove(state, { type: 'place', cell: 1 }, 0));
    ({ state } = ttt.applyMove(state, { type: 'place', cell: 4 }, 1));
    ({ state } = ttt.applyMove(state, { type: 'place', cell: 2 }, 0)); // X wins top row
    expect(state.status).toBe('win');
    expect(ttt.getLegalMoves(state, 1)).toEqual([]);
  });
});

describe('shared/games/ttt — applyMove immutability & basic flow', () => {
  test('does not mutate the input state', () => {
    const s = ttt.createInitialState();
    const snapshot = JSON.parse(JSON.stringify(s));
    ttt.applyMove(s, { type: 'place', cell: 4 }, 0);
    expect(s).toEqual(snapshot);
  });

  test('flips turn and increments moveCount on non-terminal move', () => {
    const s = ttt.createInitialState();
    const { state } = ttt.applyMove(s, { type: 'place', cell: 4 }, 0);
    expect(state.board[4]).toBe('X');
    expect(state.turn).toBe(1);
    expect(state.moveCount).toBe(1);
    expect(state.status).toBe('active');
  });

  test('emits placed event with affected cell', () => {
    const s = ttt.createInitialState();
    const { events } = ttt.applyMove(s, { type: 'place', cell: 4 }, 0);
    expect(events).toEqual([{ type: 'placed', affectedCells: [4] }]);
  });

  test('rejects out-of-turn moves', () => {
    const s = ttt.createInitialState();
    expect(() => ttt.applyMove(s, { type: 'place', cell: 0 }, 1)).toThrow(/not slot/);
  });

  test('rejects moves on occupied cells', () => {
    const s = ttt.createInitialState();
    const { state } = ttt.applyMove(s, { type: 'place', cell: 0 }, 0);
    expect(() => ttt.applyMove(state, { type: 'place', cell: 0 }, 1)).toThrow(/occupied/);
  });

  test('rejects out-of-range cells', () => {
    const s = ttt.createInitialState();
    expect(() => ttt.applyMove(s, { type: 'place', cell: 9 }, 0)).toThrow(/out of range/);
    expect(() => ttt.applyMove(s, { type: 'place', cell: -1 }, 0)).toThrow(/out of range/);
  });

  test('rejects unsupported move types', () => {
    const s = ttt.createInitialState();
    expect(() =>
      ttt.applyMove(s, /** @type {any} */ ({ type: 'transfer', from: 0, to: 1 }), 0)
    ).toThrow(/unsupported move type/);
  });
});

describe('shared/games/ttt — terminal detection', () => {
  // Helper: replay a series of moves from a fresh state.
  const play = (cells) => {
    let state = ttt.createInitialState();
    cells.forEach((cell, i) => {
      ({ state } = ttt.applyMove(state, { type: 'place', cell }, /** @type {0|1} */ (i % 2)));
    });
    return state;
  };

  test.each([
    ['top row',      [0, 3, 1, 4, 2], [0, 1, 2]],
    ['middle row',   [3, 0, 4, 1, 5], [3, 4, 5]],
    ['bottom row',   [6, 0, 7, 1, 8], [6, 7, 8]],
    ['left col',     [0, 1, 3, 4, 6], [0, 3, 6]],
    ['middle col',   [1, 0, 4, 3, 7], [1, 4, 7]],
    ['right col',    [2, 0, 5, 3, 8], [2, 5, 8]],
    ['diag \\',      [0, 1, 4, 2, 8], [0, 4, 8]],
    ['diag /',       [2, 0, 4, 1, 6], [2, 4, 6]],
  ])('X wins via %s', (_label, cells, expectedLine) => {
    const state = play(cells);
    expect(state.status).toBe('win');
    expect(state.winner).toBe(0);
    expect(state.winningCells).toEqual(expectedLine);
    expect(state.scores).toEqual([1, 0]);
  });

  test('O can win and gets the score', () => {
    // O wins middle column: X scattered, O down 1-4-7
    const state = play([0, 1, 2, 4, 3, 7]);
    expect(state.status).toBe('win');
    expect(state.winner).toBe(1);
    expect(state.scores).toEqual([0, 1]);
  });

  test('draw is detected and scores stay zero', () => {
    // Classic cat's game:
    // X O X
    // X O O
    // O X X
    const state = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(state.status).toBe('draw');
    expect(state.winner).toBeNull();
    expect(state.scores).toEqual([0, 0]);
  });
});

describe('shared/games/ttt — parity with legacy server/gameLogic calcWinner', () => {
  test.each([
    [['X','X','X','','','','','',''], 'X', [0,1,2]],
    [['','','','','O','','','O','O'], null, null],   // not a win line
    [['O','X','O','X','O','X','O','X','O'], 'O', null],
  ])('parity %#', (board, expectedMark, expectedLine) => {
    const legacy = calcWinner(board);
    const reshaped = { ...ttt.createInitialState(), board };
    const next = ttt.checkTerminal(reshaped);
    if (expectedMark === null) {
      // legacy returns null OR draw — either way our status is not 'win'
      expect(next.status).not.toBe('win');
      if (legacy?.winner === 'draw') expect(next.status).toBe('draw');
    } else {
      expect(next.status).toBe('win');
      expect(SLOT_TO_MARK[/** @type {0|1} */ (next.winner)]).toBe(expectedMark);
      if (expectedLine) expect(next.line).toEqual(expectedLine);
      // Legacy agreement
      expect(legacy.winner).toBe(expectedMark);
    }
  });

  test('mark<->slot helpers round-trip', () => {
    expect(markToSlot('X')).toBe(0);
    expect(markToSlot('O')).toBe(1);
    expect(markToSlot('')).toBe(-1);
    expect(SLOT_TO_MARK[0]).toBe('X');
    expect(SLOT_TO_MARK[1]).toBe('O');
  });
});

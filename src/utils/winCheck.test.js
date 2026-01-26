import { checkWin, checkDraw, calcWinnerWithMode } from './winCheck';

describe('checkWin', () => {
  describe('3x3 board (classic)', () => {
    const size = 3;
    const streak = 3;

    it('detects horizontal win row 0', () => {
      const board = ['X', 'X', 'X', '', '', '', '', '', ''];
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [0, 1, 2],
      });
    });

    it('detects horizontal win row 1', () => {
      const board = ['', '', '', 'O', 'O', 'O', '', '', ''];
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [3, 4, 5],
      });
    });

    it('detects horizontal win row 2', () => {
      const board = ['', '', '', '', '', '', 'X', 'X', 'X'];
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [6, 7, 8],
      });
    });

    it('detects vertical win col 0', () => {
      const board = ['O', '', '', 'O', '', '', 'O', '', ''];
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [0, 3, 6],
      });
    });

    it('detects vertical win col 1', () => {
      const board = ['', 'X', '', '', 'X', '', '', 'X', ''];
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [1, 4, 7],
      });
    });

    it('detects vertical win col 2', () => {
      const board = ['', '', 'O', '', '', 'O', '', '', 'O'];
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [2, 5, 8],
      });
    });

    it('detects diagonal win (top-left to bottom-right)', () => {
      const board = ['X', '', '', '', 'X', '', '', '', 'X'];
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [0, 4, 8],
      });
    });

    it('detects anti-diagonal win (top-right to bottom-left)', () => {
      const board = ['', '', 'O', '', 'O', '', 'O', '', ''];
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [2, 4, 6],
      });
    });

    it('returns no win for incomplete line', () => {
      const board = ['X', 'X', '', '', '', '', '', '', ''];
      expect(checkWin(board, size, streak, 'X')).toEqual({ win: false });
    });

    it('returns no win for blocked line', () => {
      const board = ['X', 'O', 'X', '', '', '', '', '', ''];
      expect(checkWin(board, size, streak, 'X')).toEqual({ win: false });
    });
  });

  describe('5x5 board (ultimate)', () => {
    const size = 5;
    const streak = 3;

    it('detects horizontal win in row 0', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[1] = 'X';
      board[2] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [0, 1, 2],
      });
    });

    it('detects horizontal win in middle of row', () => {
      // Row 2 (index 10-14), columns 1-3
      const board = Array(25).fill('');
      board[11] = 'X';
      board[12] = 'X';
      board[13] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [11, 12, 13],
      });
    });

    it('detects horizontal win at end of row', () => {
      const board = Array(25).fill('');
      board[22] = 'O';
      board[23] = 'O';
      board[24] = 'O';
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [22, 23, 24],
      });
    });

    it('detects vertical win in col 0', () => {
      const board = Array(25).fill('');
      board[0] = 'O';
      board[5] = 'O';
      board[10] = 'O';
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [0, 5, 10],
      });
    });

    it('detects vertical win in middle', () => {
      const board = Array(25).fill('');
      board[2] = 'O';
      board[7] = 'O';
      board[12] = 'O';
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [2, 7, 12],
      });
    });

    it('detects vertical win at bottom', () => {
      const board = Array(25).fill('');
      board[14] = 'X';
      board[19] = 'X';
      board[24] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [14, 19, 24],
      });
    });

    it('detects diagonal win at top-left', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[6] = 'X';
      board[12] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [0, 6, 12],
      });
    });

    it('detects diagonal win in middle', () => {
      const board = Array(25).fill('');
      board[6] = 'X';
      board[12] = 'X';
      board[18] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [6, 12, 18],
      });
    });

    it('detects anti-diagonal win', () => {
      const board = Array(25).fill('');
      board[8] = 'O';
      board[12] = 'O';
      board[16] = 'O';
      expect(checkWin(board, size, streak, 'O')).toEqual({
        win: true,
        line: [8, 12, 16],
      });
    });

    it('detects anti-diagonal win at bottom-left', () => {
      const board = Array(25).fill('');
      board[12] = 'X';
      board[16] = 'X';
      board[20] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({
        win: true,
        line: [12, 16, 20],
      });
    });

    it('no win with only 2 in a row', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[1] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({ win: false });
    });

    it('no win with gaps in line', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[1] = '';
      board[2] = 'X';
      expect(checkWin(board, size, streak, 'X')).toEqual({ win: false });
    });
  });
});

describe('checkDraw', () => {
  it('returns true for full 3x3 board', () => {
    const board = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(checkDraw(board)).toBe(true);
  });

  it('returns false for board with empty cells', () => {
    const board = ['X', 'O', '', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(checkDraw(board)).toBe(false);
  });

  it('returns true for full 5x5 board', () => {
    const board = Array(25).fill('X');
    expect(checkDraw(board)).toBe(true);
  });

  it('returns false for 5x5 board with empty cells', () => {
    const board = Array(25).fill('X');
    board[12] = '';
    expect(checkDraw(board)).toBe(false);
  });
});

describe('calcWinnerWithMode', () => {
  describe('3x3 board', () => {
    it('detects X win', () => {
      const board = ['X', 'X', 'X', 'O', 'O', '', '', '', ''];
      expect(calcWinnerWithMode(board, 3, 3)).toEqual({
        winner: 'X',
        line: [0, 1, 2],
      });
    });

    it('detects O win', () => {
      const board = ['X', 'X', '', 'O', 'O', 'O', 'X', '', ''];
      expect(calcWinnerWithMode(board, 3, 3)).toEqual({
        winner: 'O',
        line: [3, 4, 5],
      });
    });

    it('detects draw', () => {
      const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
      expect(calcWinnerWithMode(board, 3, 3)).toEqual({
        winner: 'draw',
        line: [],
      });
    });

    it('returns null when game ongoing', () => {
      const board = ['X', '', '', '', '', '', '', '', ''];
      expect(calcWinnerWithMode(board, 3, 3)).toEqual({
        winner: null,
        line: [],
      });
    });
  });

  describe('5x5 board', () => {
    it('detects X win with 3 in a row', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[1] = 'X';
      board[2] = 'X';
      expect(calcWinnerWithMode(board, 5, 3)).toEqual({
        winner: 'X',
        line: [0, 1, 2],
      });
    });

    it('detects O win with 3 in a row', () => {
      const board = Array(25).fill('');
      board[6] = 'O';
      board[12] = 'O';
      board[18] = 'O';
      expect(calcWinnerWithMode(board, 5, 3)).toEqual({
        winner: 'O',
        line: [6, 12, 18],
      });
    });

    it('returns null when ongoing', () => {
      const board = Array(25).fill('');
      board[0] = 'X';
      board[1] = 'X';
      expect(calcWinnerWithMode(board, 5, 3)).toEqual({
        winner: null,
        line: [],
      });
    });
  });
});

/**
 * Check for a winner on a generalized board
 * @param {string[]} board - Flat array of board state
 * @param {number} size - Board dimension (size x size)
 * @param {number} streak - Number in a row needed to win
 * @param {string} player - 'X' or 'O'
 * @returns {{ win: boolean, line?: number[] }}
 */
export function checkWin(board, size, streak, player) {
  // Check rows
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - streak; c++) {
      const line = [];
      let match = true;
      for (let k = 0; k < streak; k++) {
        const idx = r * size + c + k;
        line.push(idx);
        if (board[idx] !== player) {
          match = false;
          break;
        }
      }
      if (match) return { win: true, line };
    }
  }

  // Check columns
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - streak; r++) {
      const line = [];
      let match = true;
      for (let k = 0; k < streak; k++) {
        const idx = (r + k) * size + c;
        line.push(idx);
        if (board[idx] !== player) {
          match = false;
          break;
        }
      }
      if (match) return { win: true, line };
    }
  }

  // Check diagonal (top-left to bottom-right)
  for (let r = 0; r <= size - streak; r++) {
    for (let c = 0; c <= size - streak; c++) {
      const line = [];
      let match = true;
      for (let k = 0; k < streak; k++) {
        const idx = (r + k) * size + (c + k);
        line.push(idx);
        if (board[idx] !== player) {
          match = false;
          break;
        }
      }
      if (match) return { win: true, line };
    }
  }

  // Check anti-diagonal (top-right to bottom-left)
  for (let r = 0; r <= size - streak; r++) {
    for (let c = streak - 1; c < size; c++) {
      const line = [];
      let match = true;
      for (let k = 0; k < streak; k++) {
        const idx = (r + k) * size + (c - k);
        line.push(idx);
        if (board[idx] !== player) {
          match = false;
          break;
        }
      }
      if (match) return { win: true, line };
    }
  }

  return { win: false };
}

/**
 * Check for draw (board full, no winner)
 * @param {string[]} board
 * @returns {boolean}
 */
export function checkDraw(board) {
  return board.every((cell) => cell !== '');
}

/**
 * Calculate winner using mode configuration
 * @param {string[]} board
 * @param {number} size
 * @param {number} streak
 * @returns {{ winner: string | null, line: number[] }}
 */
export function calcWinnerWithMode(board, size, streak) {
  const xResult = checkWin(board, size, streak, 'X');
  if (xResult.win) {
    return { winner: 'X', line: xResult.line };
  }

  const oResult = checkWin(board, size, streak, 'O');
  if (oResult.win) {
    return { winner: 'O', line: oResult.line };
  }

  if (checkDraw(board)) {
    return { winner: 'draw', line: [] };
  }

  return { winner: null, line: [] };
}

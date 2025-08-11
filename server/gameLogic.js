// Game logic helpers
export const emptyBoard = () => Array(9).fill("");
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export function calcWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a, b, c] };
  }
  if (board.every((c) => c !== "")) return { winner: "draw", line: [] };
  return null;
}
export function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++)
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
export function initialState() {
  return {
    board: emptyBoard(),
    turn: "X",
    winner: null,
    winningLine: [],
    xScore: 0,
    oScore: 0,
  };
}

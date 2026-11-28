import { checkersMoves } from "../../shared/daily.js";
import { rushPuzzle, rushStep } from "../../shared/rush.js";

// Puzzle Rush, checked by the server (docs/ROADMAP.md item 5). A move is a cell or column number, or for Checkers {from, to}.
export const MAX_BODY = 16_000;
const MAX_PUZZLES = 200;
const MAX_PER_PUZZLE = 40;
const MAX_MOVES = 300;

export type Move = number | { from: number; to: number };
const isCell = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 400;

/** The run's moves per puzzle index, or null when the shape is not one the replay can take. */
export function parseMoves(v: unknown): Move[][] | null {
  if (!Array.isArray(v) || v.length > MAX_PUZZLES) return null;
  let total = 0;
  for (const list of v) {
    if (!Array.isArray(list) || list.length > MAX_PER_PUZZLE) return null;
    total += list.length;
    for (const m of list) if (!isCell(m) && !(m && typeof m === "object" && isCell(m.from) && isCell(m.to))) return null;
  }
  return total > MAX_MOVES ? null : (v as Move[][]);
}

/** Replays every move on `day`'s puzzles with the client's rule: one point per puzzle solved; a solve or a slip ends that puzzle. */
export function replayScore(day: string, moves: Move[][]): number {
  let score = 0;
  moves.forEach((list, k) => {
    const p = rushPuzzle(day, k);
    let state = { board: p.board, left: p.n };
    for (const raw of list) {
      let move: any = raw;
      if (p.game === "checkers") {
        if (typeof raw !== "object") continue;
        move = checkersMoves(state.board, p.turn).find((m: any) => m.from === raw.from && m.to === raw.to);
        if (!move) continue; // not a legal move: the client would not have sent it
      } else if (typeof raw !== "number" || raw >= (p.game === "connect4" ? 7 : state.board.length)) continue;
      const r = rushStep(p, state, move);
      if (r.result === "solved") score++;
      if (r.result !== "continue") return;
      state = r;
    }
  });
  return score;
}

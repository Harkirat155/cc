import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import connect4 from "@shared/games/connect4.js";
import { defenderReply, keepsWin, puzzleForDate, todayUtc } from "@shared/daily.js";
import GameBoard from "./components/GameBoard";

const KEY = "cc.daily";
const MARKS = ["R", "Y"];
const COLOR = ["Red", "Yellow"];

const load = (date) => {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY));
    if (s && s.date === date) return { tries: s.tries || 1, solved: Boolean(s.solved) };
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return { tries: 1, solved: false };
};

const drop = (board, col, mark) => {
  const next = board.slice();
  const row = [5, 4, 3, 2, 1, 0].find((r) => next[r * 7 + col] === "");
  next[row * 7 + col] = mark;
  return next;
};

export const resultLine = (date, tries) =>
  `CrissCross daily ${date} · solved in ${tries} ${tries === 1 ? "try" : "tries"} · harkirat155.github.io/cc/daily`;

function CopyResult({ text }) {
  const [state, setState] = useState(""); // "" | "ok" | "failed"
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("ok"); }
    catch { setState("failed"); }
  };
  return (
    <>
      <button type="button" onClick={copy} className="rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">
        {state === "ok" ? "Copied" : "Copy"}
      </button>
      {state === "failed" && (
        <input readOnly aria-label="Result line" value={text} onFocus={(e) => e.target.select()} className="mt-2 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm" />
      )}
    </>
  );
}

function Daily() {
  const date = useMemo(() => todayUtc(), []);
  const puzzle = useMemo(() => puzzleForDate(date), [date]);
  const [saved, setSaved] = useState(() => load(date));
  const [board, setBoard] = useState(puzzle.board);
  const [left, setLeft] = useState(puzzle.n);
  const [slipped, setSlipped] = useState(false);
  const [note, setNote] = useState("");
  const status = useRef(null);
  const me = puzzle.turn;

  const save = (next) => {
    setSaved(next);
    try { window.localStorage.setItem(KEY, JSON.stringify({ date, ...next })); } catch { /* ignore */ }
  };
  const done = saved.solved || slipped;

  const play = (col) => {
    if (done || board[col] !== "") return;
    const kept = keepsWin(board, col, me, left);
    let next = drop(board, col, MARKS[me]);
    if (connect4.checkTerminal({ board: next }).status === "win") {
      setBoard(next);
      setNote(`You dropped in column ${col + 1} and won.`);
      save({ ...saved, solved: true });
      return;
    }
    const reply = defenderReply(next, me, left - 1);
    next = drop(next, reply, MARKS[1 - me]);
    setBoard(next);
    setNote(`You dropped in column ${col + 1}. They answered in column ${reply + 1}.`);
    if (!kept || left < 2 || connect4.checkTerminal({ board: next }).status !== "active") setSlipped(true);
    else setLeft(left - 1);
  };

  const retry = () => {
    save({ ...saved, tries: saved.tries + 1 });
    setBoard(puzzle.board);
    setLeft(puzzle.n);
    setSlipped(false);
    setNote("Board reset.");
    status.current?.focus();
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
        <Link to="/" className="self-start text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← CrissCross</Link>
        <header className="self-start">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Daily puzzle · {date}</h1>
          <p className="mt-2 text-foreground/70">One puzzle a day, the same for everyone. New puzzle at 00:00 UTC.</p>
          <p className="mt-2 font-medium">{COLOR[me]} to move: win in {puzzle.n} of your moves.</p>
        </header>
        <GameBoard
          squares={board}
          onSquareClick={play}
          winningSquares={[]}
          rows={6}
          cols={7}
          playerInfo={connect4.playerInfo}
          boardSpec={connect4.boardSpec}
        />
        <div ref={status} tabIndex={-1} role="status" aria-live="polite" className="w-full text-center outline-none">
          {saved.solved ? (
            <>
              <p className="font-semibold">Solved.</p>
              <p className="mt-2 break-words text-sm">{resultLine(date, saved.tries)}</p>
              <div className="mt-2"><CopyResult text={resultLine(date, saved.tries)} /></div>
            </>
          ) : slipped ? (
            <>
              <p className="font-semibold">That lets them off the hook</p>
              <button type="button" onClick={retry} className="mt-2 rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">Try again</button>
            </>
          ) : (
            <p className="text-sm text-foreground/70">{note || `Try ${saved.tries}. ${left} ${left === 1 ? "move" : "moves"} left to win.`}</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default Daily;

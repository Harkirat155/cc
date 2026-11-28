import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import connect4 from "@shared/games/connect4.js";
import ttt from "@shared/games/ttt.js";
import checkers from "@shared/games/checkers.js";
import { GAME_NAMES, checkersMoves, todayUtc } from "@shared/daily.js";
import { RUSH_SECONDS, rushPuzzle, rushStep } from "@shared/rush.js";
import GameBoard from "./components/GameBoard";
import { FiveWindow, ShareResult } from "./Daily";
import { tally } from "./lib/tally";

const KEY = "cc.rush";
const NAMES = { ttt: ["X", "O"], connect4: ["Red", "Yellow"], five: ["Blue", "Green"], checkers: ["Red", "Amber"] };
const SHAPE = { ttt: [3, 3, ttt], connect4: [6, 7, connect4], checkers: [8, 8, checkers] };
export const RUSH_LINK = "https://harkirat155.github.io/cc/rush";
export const rushShareText = (n) => `I solved ${n} ${n === 1 ? "puzzle" : "puzzles"} in 3 minutes on CrissCross Rush`;

// A challenge target travels as a bare number in `?beat=N` (1..999); anything else is ignored.
export const parseBeat = (v) => (/^[1-9]\d{0,2}$/.test(v || "") ? Number(v) : 0);
export const beatLink = (n) => `${RUSH_LINK}?beat=${n}`;
const beatVerdict = (score, target) =>
  score > target ? `You beat ${target} with ${score}` : score === target ? `You tied ${target}, one more beats it` : `Not beaten: ${score} against ${target}`;

function Challenge({ score }) {
  const [state, setState] = useState(""); // "" | "ok" | "failed"
  const url = beatLink(score);
  const send = async () => {
    tally("cc", "rush_beat_link");
    try {
      if (navigator.share) { await navigator.share({ text: `Beat my ${score} on CrissCross Rush`, url }); return; }
    } catch (e) { if (e?.name === "AbortError") return; /* any other failure: fall back to copying */ }
    try { await navigator.clipboard.writeText(url); setState("ok"); }
    catch { setState("failed"); }
  };
  return (
    <>
      <button type="button" onClick={send} className="min-h-11 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium">Challenge a friend</button>
      {state === "ok" && <p role="status" className="text-sm text-foreground/70">Link copied</p>}
      {state === "failed" && <input readOnly aria-label="Challenge link" value={url} onFocus={(e) => e.target.select()} className="block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm" />}
    </>
  );
}

const readBest = (day) => {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY));
    if (s && s.date === day && Number.isInteger(s.best) && s.best >= 0) return s.best;
  } catch { /* storage unavailable or corrupt */ }
  return 0;
};

const prompt = (p) => {
  const who = NAMES[p.game][p.turn];
  if (p.game === "five") return `${who} to move: make the five that wins now.`;
  if (p.game === "ttt") return `${who} to move: ${p.kind === "win" ? "win now" : "block their win"}.`;
  return `${who} to move: win in ${p.n} of your moves.`;
};

// One puzzle; remounted (keyed by slot) for each next one so its board state always starts fresh.
function Puzzle({ p, onDone }) {
  const [state, setState] = useState({ board: p.board, left: p.n });
  const [sel, setSel] = useState(null);
  const { board } = state;
  const play = (move) => {
    const r = rushStep(p, state, move);
    if (r.result === "continue") setState(r); else onDone(r.result === "solved");
  };
  const tap = (cell) => {
    if (p.game !== "checkers") return play(cell);
    const piece = board[cell];
    if (piece && piece.owner === p.turn) { setSel(sel === cell ? null : cell); return; }
    const move = sel === null ? null : checkersMoves(board, p.turn).find((m) => m.from === sel && m.to === cell);
    if (move) play(move); else setSel(null);
  };
  const [rows, cols, rules] = SHAPE[p.game] || [];
  return p.game === "five" ? (
    <FiveWindow squares={board} onCell={tap} winning={[]} disabled={false} />
  ) : (
    <GameBoard
      squares={board}
      onSquareClick={tap}
      rows={rows}
      cols={cols}
      moveStyle={p.game === "checkers" ? "select-target" : "place"}
      selection={sel}
      legalTargets={p.game === "checkers" && sel !== null ? checkersMoves(board, p.turn).filter((m) => m.from === sel) : undefined}
      playerInfo={rules.playerInfo}
      boardSpec={rules.boardSpec}
      disabled={false}
    />
  );
}

function Run({ day, onEnd }) {
  const [k, setK] = useState(0);
  const [solved, setSolved] = useState(0);
  const [left, setLeft] = useState(RUSH_SECONDS);
  const [flash, setFlash] = useState("");
  const p = useMemo(() => rushPuzzle(day, k), [day, k]);
  const score = useRef(0);
  const end = useRef(Date.now() + RUSH_SECONDS * 1000);

  useEffect(() => {
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { window.clearInterval(t); onEnd(score.current); }
    }, 250);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (ok) => {
    if (ok) { score.current += 1; setSolved(score.current); }
    setFlash(ok ? "Solved" : "Missed, next puzzle");
    setK(k + 1);
  };
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      <div className="flex w-full items-baseline justify-between text-lg font-semibold">
        <span>Solved {solved}</span>
        <span role="timer" aria-label="Time left">{mm}:{ss}</span>
      </div>
      <p className="w-full font-medium">{GAME_NAMES[p.game]}. {prompt(p)}</p>
      <Puzzle key={k} p={p} onDone={done} />
      <p role="status" aria-live="polite" className="text-sm text-foreground/70">{flash}</p>
    </>
  );
}

function Rush() {
  const day = useMemo(() => todayUtc(), []);
  const target = parseBeat(useSearchParams()[0].get("beat"));
  const [phase, setPhase] = useState("intro"); // intro | run | done
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(day));
  const finish = (n) => {
    const top = Math.max(n, readBest(day));
    try { window.localStorage.setItem(KEY, JSON.stringify({ date: day, best: top })); } catch { /* ignore */ }
    tally("cc", "rush_finish");
    setScore(n);
    setBest(top);
    setPhase("done");
  };
  const start = () => { tally("cc", "rush_start"); setPhase("run"); };
  const pill = "min-h-11 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium";
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
        {phase !== "run" && <Link to="/daily" className="self-start text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Daily puzzle</Link>}
        {phase === "intro" && (
          <header className="self-start">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Puzzle Rush</h1>
            <p className="mt-2 text-foreground/70">Solve as many puzzles as you can in 3 minutes, across Tic-Tac-Toe, Connect Four, Five in a Row and Checkers. A move that lets the win slip skips that puzzle. Same run for everyone today.</p>
            {target > 0 && <p className="mt-2 text-lg font-semibold">Beat {target}</p>}
            {best > 0 && <p className="mt-2 text-sm text-foreground/70">Your best today: {best}</p>}
            <button type="button" onClick={start} className={`${pill} mt-4`}>Start</button>
          </header>
        )}
        {phase === "run" && <Run day={day} onEnd={finish} />}
        {phase === "done" && (
          <section className="flex flex-col items-center gap-3 text-center" role="status">
            <h1 className="text-3xl font-semibold tracking-tight">You solved {score} {score === 1 ? "puzzle" : "puzzles"}</h1>
            {target > 0 && <p className="font-medium">{beatVerdict(score, target)}</p>}
            <p className="text-foreground/70">Best today: {best}</p>
            <ShareResult text={rushShareText(score)} url={RUSH_LINK} />
            {score > 0 && <Challenge score={score} />}
            <button type="button" onClick={start} className={pill}>Run again</button>
          </section>
        )}
      </div>
    </main>
  );
}

export default Rush;

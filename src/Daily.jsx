import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import connect4 from "@shared/games/connect4.js";
import { defenderReply, keepsWin, puzzleForDate, solutionLine, todayUtc } from "@shared/daily.js";
import GameBoard from "./components/GameBoard";
import { badgeBase } from "./arenaShared";
import { tally } from "./lib/tally";

const KEY = "cc.daily";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
const FIRST_DAY = "2026-11-27"; // the day the puzzle launched; /daily/:date opens a date from here to today
const MARKS = ["R", "Y"];
const COLOR = ["Red", "Yellow"];

// The record is {date, tries, solved} for the latest day played (the original shape) plus `days`, the UTC dates
// solved on that day's own puzzle. Records written before streaks have no `days`; their `date` counts if solved.
// `pastTries` maps a past date to the tries spent on it so far, so leaving and coming back keeps the count; it never touches
// the latest-day fields. A streak is consecutive UTC days solved, whenever each was solved: solving yesterday's puzzle late counts.
const readStore = () => {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY));
    if (s && typeof s === "object" && !Array.isArray(s)) {
      const today = todayUtc();
      const listed = [...(Array.isArray(s.days) ? s.days : []), ...(s.solved ? [s.date] : [])];
      const days = [...new Set(listed.filter((d) => typeof d === "string" && DAY.test(d) && d <= today))].sort().slice(-MAX_DAYS);
      const raw = s.pastTries && typeof s.pastTries === "object" && !Array.isArray(s.pastTries) ? s.pastTries : {};
      const pastTries = Object.fromEntries(Object.entries(raw).filter(([d, n]) => DAY.test(d) && Number.isInteger(n) && n >= 1).sort().slice(-MAX_DAYS));
      return { ...s, days, pastTries };
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return { days: [], pastTries: {} };
};

const load = (date) => {
  const s = readStore();
  return s.date === date ? { tries: s.tries || 1, solved: Boolean(s.solved) } : { tries: 1, solved: false };
};

const loadPast = (date) => {
  const s = readStore();
  return { tries: s.pastTries[date] || (s.date === date ? s.tries || 1 : 1), solved: false };
};

const isDay = (d, today) => typeof d === "string" && DAY.test(d) && d >= FIRST_DAY && d <= today && todayUtc(new Date(`${d}T00:00:00Z`)) === d;

const dayBefore = (date) => todayUtc(new Date(Date.parse(`${date}T00:00:00Z`) - 86400000));

const streakTo = (date, days) => {
  const set = new Set(days);
  let n = 0;
  for (let d = date; set.has(d); d = dayBefore(d)) n++;
  return n;
};

const drop = (board, col, mark) => {
  const next = board.slice();
  const row = [5, 4, 3, 2, 1, 0].find((r) => next[r * 7 + col] === "");
  next[row * 7 + col] = mark;
  return next;
};

// The share text holds only numbers from this device's record. The link carries the date alone (the Worker's /d/:date card), so no result number is ever parsed from a URL.
export const shareText = (date, tries, streak = 1) =>
  `CrissCross Daily ${date} · solved in ${tries} ${tries === 1 ? "try" : "tries"}${streak >= 2 ? ` · ${streak} days in a row` : ""}`;
export const shareLink = (date) => `${badgeBase()}/d/${date}`;
export const resultLine = (date, tries, streak = 1) => `${shareText(date, tries, streak)} ${shareLink(date)}`;

function ShareResult({ date, tries, streak }) {
  const [state, setState] = useState(""); // "" | "ok" | "failed"
  const text = shareText(date, tries, streak);
  const url = shareLink(date);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch (e) { if (e?.name === "AbortError") return; /* any other failure: fall back to copying */ }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setState("ok"); }
    catch { setState("failed"); }
  };
  return (
    <>
      <button type="button" onClick={share} className="rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">
        {state === "ok" ? "Copied" : "Share result"}
      </button>
      {state === "failed" && (
        <>
        <p className="mt-2 text-sm">Sharing is blocked here. Copy this by hand:</p>
        <input readOnly aria-label="Result line" value={`${text} ${url}`} onFocus={(e) => e.target.select()} className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm" />
        </>
      )}
    </>
  );
}

// Keys the puzzle by date and moves to the new one at the next 00:00 UTC.
function Daily() {
  const [today, setToday] = useState(() => todayUtc());
  const [past, setPast] = useState(false);
  // Arrivals through a shared /d/ link (the Worker adds ?via=d): the share bet's kill-rule signal. Counted once, then the marker is
  // dropped from the address (replace, no new history entry) so a reload or a bookmark of this page never counts again.
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const q = new window.URLSearchParams(search);
    if (q.get("via") !== "d") return;
    tally("cc", "daily_link");
    q.delete("via");
    const rest = q.toString();
    navigate(`${pathname}${rest ? `?${rest}` : ""}${hash}`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const next = Date.parse(`${today}T00:00:00Z`) + 86400000;
    const t = window.setTimeout(() => { setToday(todayUtc()); setPast(false); }, Math.max(next - Date.now(), 0) + 50);
    return () => window.clearTimeout(t);
  }, [today]);
  // /daily/:date opens that day's puzzle; a date outside launch..today shows today's with a note.
  const { date: asked } = useParams();
  const dated = isDay(asked, today) && asked !== today;
  const date = dated ? asked : past ? dayBefore(today) : today;
  const onSwitch = () => (dated ? navigate("/daily") : setPast(!past));
  return <DailyPuzzle key={date} date={date} today={today} unavailable={asked !== undefined && !isDay(asked, today)} onSwitch={onSwitch} />;
}

function DailyPuzzle({ date, today, unavailable, onSwitch }) {
  const past = date !== today;
  const puzzle = useMemo(() => puzzleForDate(date), [date]);
  const [saved, setSaved] = useState(() => (past ? loadPast(date) : load(date)));
  const [days, setDays] = useState(() => readStore().days);
  const [already] = useState(() => past && days.includes(date)); // a past day solved earlier shows no new result line
  const [board, setBoard] = useState(puzzle.board);
  const [left, setLeft] = useState(puzzle.n);
  const [slipped, setSlipped] = useState(false);
  const [note, setNote] = useState("");
  const [shown, setShown] = useState(null); // null = my board; else how many moves of the winning line are on the board
  const line = useMemo(() => solutionLine(puzzle), [puzzle]);
  const status = useRef(null);
  const me = puzzle.turn;

  // Yesterday's puzzle never rewrites today's record; it only adds its date to `days`.
  const save = (next) => {
    setSaved(next);
    const keep = next.solved ? [...new Set([...readStore().days, date])].sort().slice(-MAX_DAYS) : readStore().days;
    if (next.solved) setDays(keep);
    const store = readStore();
    const pastTries = past && !next.solved ? { ...store.pastTries, [date]: next.tries } : store.pastTries;
    const rec = past ? { ...store, days: keep, pastTries } : { date, ...next, days: keep, pastTries };
    try { window.localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* ignore */ }
  };
  const done = saved.solved || slipped || already;
  const streak = streakTo(date, days);

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
    if (!kept || left < 2 || connect4.checkTerminal({ board: next }).status !== "active") {
      setSlipped(true);
      save({ ...saved, tries: saved.tries + 1 }); // the failed try is counted now, so a reload cannot undercount
    } else setLeft(left - 1);
  };

  const retry = () => {
    setBoard(puzzle.board);
    setLeft(puzzle.n);
    setSlipped(false);
    setShown(null);
    setNote("Board reset.");
    status.current?.focus();
  };

  // The solution view is derived: the puzzle's start position plus the first `shown` moves of the line. Nothing is saved.
  const viewBoard = shown === null ? board : line.slice(0, shown).reduce((b, m) => drop(b, m.col, m.mark), puzzle.board);
  const end = shown === null ? null : connect4.checkTerminal({ board: viewBoard });
  const solutionWin = end?.status === "win" ? end : null;
  const pill = "min-h-11 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
        <Link to="/" className="self-start text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← CrissCross</Link>
        <header className="self-start">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Daily puzzle · {date}{date === dayBefore(today) ? " · yesterday's" : ""}</h1>
          {unavailable && <p className="mt-2 font-medium">{"That puzzle isn't available, here is today's."}</p>}
          <p className="mt-2 text-foreground/70">One puzzle a day, the same for everyone. New puzzle at 00:00 UTC.</p>
          <p className="mt-2 font-medium">{COLOR[me]} to move: win in {puzzle.n} of your moves.</p>
        </header>
        <GameBoard
          squares={viewBoard}
          onSquareClick={play}
          winningSquares={solutionWin?.line ?? []}
          rows={6}
          cols={7}
          playerInfo={connect4.playerInfo}
          boardSpec={connect4.boardSpec}
          disabled={done || shown !== null}
        />
        <div ref={status} tabIndex={-1} role="status" aria-live="polite" className="w-full rounded-lg p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
          {shown !== null ? (
            // The board's own sr-only status announces "<Side> dropped in column N"; this caption adds only what it does not say (progress, the winner).
            <p className="font-semibold">{solutionWin ? `Solution · ${COLOR[solutionWin.winner]} wins` : shown === 0 ? `Solution · ${line.length} moves, press Next move` : `Solution · move ${shown} of ${line.length}`}</p>
          ) : already ? (
            <>
              <p className="font-semibold">Already solved.</p>
              <p className="mt-1 text-sm">Day {streak} in a row</p>
            </>
          ) : saved.solved ? (
            <>
              <p className="font-semibold">Solved.</p>
              <p className="mt-1 text-sm">Day {streak} in a row</p>
              <p className="mt-2 break-words text-sm">{resultLine(date, saved.tries, streak)}</p>
              <div className="mt-2"><ShareResult date={date} tries={saved.tries} streak={streak} /></div>
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
        {done && shown === null && (
          <button type="button" onClick={() => setShown(0)} className={pill}>Show the solution</button>
        )}
        {shown !== null && (
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setShown(shown + 1)} disabled={shown >= line.length} className={pill}>Next move</button>
            <button type="button" onClick={() => setShown(null)} className={pill}>Back to my board</button>
          </div>
        )}
        {(past || done) && (
          <button type="button" onClick={onSwitch} className="rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">
            {past ? "Back to today's" : "Try yesterday's"}
          </button>
        )}
      </div>
    </main>
  );
}

export default Daily;

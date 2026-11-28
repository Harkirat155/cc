import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import connect4 from "@shared/games/connect4.js";
import ttt from "@shared/games/ttt.js";
import five from "@shared/games/five.js";
import checkers from "@shared/games/checkers.js";
import { FIVE_WINDOW, GAME_NAMES, checkersDefenderReply, checkersMoves, checkersPlay, checkersPuzzleForDate, checkersSolutionLine, defenderReply, fivePuzzleForDate, gameForDate, keepsWin, puzzleForDate, solutionLine, todayUtc, tttPuzzleForDate } from "@shared/daily.js";
import GameBoard from "./components/GameBoard";
import { paletteForValue } from "./components/games/boardPresentationUtils";
import { getGamePalette } from "./components/games/palette";
import { badgeBase } from "./arenaShared";
import { tally } from "./lib/tally";
import { downloadRemind } from "./lib/remindIcs";
import { liveUrl } from "./Live";

const KEY = "cc.daily";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
export const FIRST_DAY = "2026-11-27"; // the day the puzzle launched; /daily/:date opens a date from here to today
const MARKS = ["R", "Y"];
const COLOR = ["Red", "Yellow"];

// The record is {date, tries, solved} for the latest day played (the original shape) plus `days`, the UTC dates
// solved on that day's own puzzle. Records written before streaks have no `days`; their `date` counts if solved.
// `pastTries` maps a past date to the tries spent on it so far, so leaving and coming back keeps the count; it never touches
// the latest-day fields. A streak is consecutive UTC days solved, whenever each was solved: solving yesterday's puzzle late counts.
export const readStore = () => {
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

export const ckCell = (cell) => `row ${Math.floor(cell / 8) + 1}, column ${(cell % 8) + 1}`;

const drop = (board, col, mark) => {
  const next = board.slice();
  const row = [5, 4, 3, 2, 1, 0].find((r) => next[r * 7 + col] === "");
  next[row * 7 + col] = mark;
  return next;
};

// The share text holds only numbers from this device's record. The link carries the date alone (the Worker's /d/:date card), so no result number is ever parsed from a URL.
export const shareText = (date, tries, streak = 1, game = "connect4") =>
  `CrissCross Daily ${date}${game === "connect4" ? "" : ` · ${GAME_NAMES[game]}`} · solved in ${tries} ${tries === 1 ? "try" : "tries"}${streak >= 2 ? ` · ${streak} days in a row` : ""}`;
export const shareLink = (date) => `${badgeBase()}/d/${date}`;
export const resultLine = (date, tries, streak = 1, game = "connect4") => `${shareText(date, tries, streak, game)} ${shareLink(date)}`;

export function ShareResult({ text, url }) {
  const [state, setState] = useState(""); // "" | "ok" | "failed"
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

// Five in a Row shows a 7x7 window of its 15x15 board (every stone is inside it) so each cell is a 44px target at 390px wide.
// Cells are full-board indices; labels count rows and columns from the window's corner.
const fiveRc = (cell) => ({ row: Math.floor(cell / 15) - FIVE_WINDOW.top + 1, col: (cell % 15) - FIVE_WINDOW.left + 1 });
const FIVE_PALETTE = getGamePalette("five");

export function FiveWindow({ squares, onCell, winning, disabled }) {
  const { top, left, size } = FIVE_WINDOW;
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-foreground/10 bg-foreground/[0.02] p-1 shadow-2xl" data-tour="board">
      <div className="grid grid-cols-7">
        {Array.from({ length: size * size }, (_, k) => {
          const cell = (top + Math.floor(k / size)) * 15 + left + (k % size);
          const value = squares[cell];
          const info = paletteForValue(value, five.playerInfo, FIVE_PALETTE);
          const { row, col } = fiveRc(cell);
          const win = winning.includes(cell);
          return (
            <button
              key={cell}
              type="button"
              onClick={() => onCell(cell)}
              disabled={disabled || Boolean(value)}
              aria-label={`Row ${row}, column ${col}, ${value ? `${info?.label?.replace(/^Player /, "") || value}${win ? " (winning)" : ""}` : "empty"}`}
              className="flex aspect-square min-h-11 items-center justify-center border border-foreground/10 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-default"
            >
              {value && <span className={`h-[72%] w-[72%] rounded-full border ${info?.piece || "bg-stone-500"} ${win ? "scale-110 ring-2 ring-foreground/60" : ""}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Per-game tally name: Connect Four keeps the original bare names.
const evt = (base, game) => (game === "connect4" ? base : `${base}_${game}`);

// "Play someone now": one fetch of GET /api/live when the day is done. A seat of the day's own game waiting for a player is joined directly;
// on no seat, a failure or a slow answer the link already points at the lobby, so it is never a spinner or a dead button.
function PlayNow({ game }) {
  const [seat, setSeat] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await window.fetch(liveUrl());
        if (!res.ok) return;
        const body = await res.json();
        const open = Array.isArray(body.open) ? body.open.find((o) => o?.gameId === game && typeof o.roomId === "string" && o.roomId) : null;
        if (live && open) setSeat(open.roomId);
      } catch { /* the lobby link stays */ }
    })();
    return () => { live = false; };
  }, [game]);
  return (
    <Link to={seat ? `/room/${encodeURIComponent(seat)}` : "/lobby"} onClick={() => tally("cc", evt("daily_play", game))} className="rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">
      Play someone now
    </Link>
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
  const { date: asked } = useParams();
  useEffect(() => {
    const q = new window.URLSearchParams(search);
    if (q.get("via") !== "d") return;
    // /daily/:date?via=d is the date the link shared; the event is per game so the kill rule reads Tic-Tac-Toe days apart (Connect Four keeps `daily_link`).
    const shared = isDay(asked, today) ? asked : today;
    tally("cc", evt("daily_link", gameForDate(shared)));
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
  const dated = isDay(asked, today) && asked !== today;
  const date = dated ? asked : past ? dayBefore(today) : today;
  const onSwitch = () => (dated ? navigate("/daily") : setPast(!past));
  return <DailyPuzzle key={date} date={date} today={today} unavailable={asked !== undefined && !isDay(asked, today)} onSwitch={onSwitch} />;
}

function DailyPuzzle({ date, today, unavailable, onSwitch }) {
  const past = date !== today;
  const game = gameForDate(date);
  const isTtt = game === "ttt";
  const isFive = game === "five";
  const isCk = game === "checkers";
  const oneMove = isTtt || isFive; // a one-move position with `answers`, not a Connect Four forced win
  const rules = isCk ? checkers : isFive ? five : isTtt ? ttt : connect4;
  const marks = isFive ? ["B", "G"] : isTtt ? ["X", "O"] : MARKS;
  const names = isCk ? ["Red", "Amber"] : isFive ? ["Blue", "Green"] : isTtt ? ["X", "O"] : COLOR;
  const puzzle = useMemo(() => (isCk ? checkersPuzzleForDate(date) : isFive ? fivePuzzleForDate(date) : isTtt ? tttPuzzleForDate(date) : puzzleForDate(date)), [date, isTtt, isFive, isCk]);
  const rcOf = (cell) => (isFive ? fiveRc(cell) : { row: Math.floor(cell / 3) + 1, col: (cell % 3) + 1 });
  const [saved, setSaved] = useState(() => (past ? loadPast(date) : load(date)));
  const [days, setDays] = useState(() => readStore().days);
  const [already] = useState(() => past && days.includes(date)); // a past day solved earlier shows no new result line
  const [board, setBoard] = useState(puzzle.board);
  const [left, setLeft] = useState(puzzle.n);
  const [slipped, setSlipped] = useState(false);
  const [note, setNote] = useState("");
  const [sel, setSel] = useState(null); // Checkers: the piece picked up
  const [shown, setShown] = useState(null); // null = my board; else how many moves of the winning line are on the board
  const line = useMemo(() => (oneMove ? [{ cell: puzzle.answers[0], mark: marks[puzzle.turn] }] : isCk ? checkersSolutionLine(puzzle) : solutionLine(puzzle)), [puzzle, oneMove, isCk]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // Checkers: tap a piece, then a square it can reach. The same search as the generator says whether the win is still forced,
  // and the defender answers with its best reply, exactly as in Connect Four.
  const playCk = (cell) => {
    if (done) return;
    const piece = board[cell];
    if (piece && piece.owner === me) { setSel(sel === cell ? null : cell); return; }
    const move = sel === null ? null : checkersMoves(board, me).find((m) => m.from === sel && m.to === cell);
    if (!move) { setSel(null); return; }
    setSel(null);
    const r = checkersPlay(board, me, move, left);
    const said = `You moved ${ckCell(move.from)} to ${ckCell(move.to)}${move.captures ? ", capturing" : ""}`;
    if (r.won) {
      setBoard(r.board);
      setNote(`${said} and won.`);
      tally("cc", evt("daily_solve", game)); // once per day solved: `done` blocks any further move on this day
      save({ ...saved, solved: true });
      return;
    }
    const reply = checkersDefenderReply(r.board, me, left - 1);
    const answered = checkersPlay(r.board, 1 - me, reply, 0);
    setBoard(answered.board);
    setNote(`${said}. They moved ${ckCell(reply.from)} to ${ckCell(reply.to)}.`);
    if (!r.kept || left < 2 || answered.won) {
      setSlipped(true);
      save({ ...saved, tries: saved.tries + 1 });
    } else setLeft(left - 1);
  };

  const play = (col) => {
    if (isCk) return playCk(col);
    if (done || board[col] !== "") return;
    if (oneMove) {
      const solves = puzzle.answers.includes(col);
      const { row, col: c } = rcOf(col);
      setBoard(board.map((v, i) => (i === col ? marks[me] : v)));
      setNote(`You played row ${row}, column ${c}${solves ? (isFive || puzzle.kind === "win" ? " and won." : " and blocked.") : "."}`);
      if (solves) {
        tally("cc", evt("daily_solve", game)); // once per day solved: `done` blocks any further move on this day
        save({ ...saved, solved: true });
      } else {
        setSlipped(true);
        save({ ...saved, tries: saved.tries + 1 });
      }
      return;
    }
    const kept = keepsWin(board, col, me, left);
    let next = drop(board, col, marks[me]);
    if (connect4.checkTerminal({ board: next }).status === "win") {
      setBoard(next);
      setNote(`You dropped in column ${col + 1} and won.`);
      tally("cc", "daily_solve"); // once per day solved: `done` blocks any further move on this day
      save({ ...saved, solved: true });
      return;
    }
    const reply = defenderReply(next, me, left - 1);
    next = drop(next, reply, marks[1 - me]);
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
    setSel(null);
    setSlipped(false);
    setShown(null);
    setNote("Board reset.");
    status.current?.focus();
  };

  // The solution view is derived: the puzzle's start position plus the first `shown` moves of the line. Nothing is saved.
  const place = (b, m) => (isCk ? checkersPlay(b, m.turn, m.move, 0).board : oneMove ? b.map((v, i) => (i === m.cell ? m.mark : v)) : drop(b, m.col, m.mark));
  const viewBoard = shown === null ? board : line.slice(0, shown).reduce(place, puzzle.board);
  const end = shown === null || isCk ? null : rules.checkTerminal({ board: viewBoard });
  const ckLast = isCk && shown > 0 ? line[shown - 1] : null;
  // The line ends on the attacker's capturing move, which leaves the opponent without a piece or a move.
  const solutionWin = isCk ? (ckLast && shown === line.length && ckLast.turn === me ? { winner: me, line: [ckLast.move.to] } : null) : end?.status === "win" ? end : null;
  // Tic-Tac-Toe boards have no move announcer of their own (GameBoard speaks Connect Four drops only), so the caption says where the mark went.
  // Five in a Row says it with the shown window's own row and column numbers, and the mark by its colour name.
  const last = oneMove && !isCk && shown > 0 ? line[shown - 1] : null;
  const step = last ? `${names[marks.indexOf(last.mark)]} at row ${rcOf(last.cell).row}, column ${rcOf(last.cell).col} · ` : ckLast ? `${names[ckLast.turn]} ${ckCell(ckLast.move.from)} to ${ckCell(ckLast.move.to)} · ` : "";
  const pill = "min-h-11 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5">
        <Link to="/" className="self-start text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← CrissCross</Link>
        <header className="self-start">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Daily puzzle · {date}{game !== "connect4" ? ` · ${GAME_NAMES[game]}` : ""}{date === dayBefore(today) ? " · yesterday's" : ""}</h1>
          {unavailable && <p className="mt-2 font-medium">{"That puzzle isn't available, here is today's."}</p>}
          <p className="mt-2 text-foreground/70">One puzzle a day, the same for everyone. New puzzle at 00:00 UTC.</p>
          {isCk && <p className="mt-2 text-sm text-foreground/70">Men move forward, kings both ways. Jump an enemy piece to capture it; jumping is your choice, and a jump is one hop. Win by taking every piece or leaving them no move.</p>}
          <p className="mt-2 font-medium">{isFive ? `${names[me]} to move: make the five that wins now.` : isTtt ? `${names[me]} to move: ${puzzle.kind === "win" ? "win now" : "block their win"}.` : `${names[me]} to move: win in ${puzzle.n} of your moves.`}</p>
        </header>
        {isFive ? (
          <FiveWindow squares={viewBoard} onCell={play} winning={solutionWin?.line ?? []} disabled={done || shown !== null} />
        ) : (
          <GameBoard
            squares={viewBoard}
            onSquareClick={play}
            winningSquares={solutionWin?.line ?? []}
            rows={isCk ? 8 : isTtt ? 3 : 6}
            cols={isCk ? 8 : isTtt ? 3 : 7}
            moveStyle={isCk ? "select-target" : "place"}
            selection={sel}
            legalTargets={isCk && sel !== null ? checkersMoves(board, me).filter((m) => m.from === sel) : undefined}
            playerInfo={rules.playerInfo}
            boardSpec={rules.boardSpec}
            disabled={done || shown !== null}
          />
        )}
        <div ref={status} tabIndex={-1} role="status" aria-live="polite" className="w-full rounded-lg p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
          {shown !== null ? (
            // The board's own sr-only status announces "<Side> dropped in column N"; this caption adds only what it does not say (progress, the winner).
            <p className="font-semibold">{solutionWin ? `Solution · ${step}${names[solutionWin.winner]} wins` : shown === 0 ? `Solution · ${line.length} ${line.length === 1 ? "move" : "moves"}, press Next move` : `Solution · ${step}move ${shown} of ${line.length}`}</p>
          ) : already ? (
            <>
              <p className="font-semibold">Already solved.</p>
              <p className="mt-1 text-sm">Day {streak} in a row</p>
            </>
          ) : saved.solved ? (
            <>
              <p className="font-semibold">Solved.</p>
              <p className="mt-1 text-sm">Day {streak} in a row</p>
              <p className="mt-2 break-words text-sm">{resultLine(date, saved.tries, streak, game)}</p>
              <div className="mt-2"><ShareResult text={shareText(date, saved.tries, streak, game)} url={shareLink(date)} /></div>
              <div className="mt-2">
                <button type="button" onClick={() => { tally("cc", "daily_remind"); downloadRemind(); }} className="text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground">Remind me tomorrow</button>
                <p className="mt-1 text-xs text-foreground/60">Adds a daily reminder at the new puzzle to your calendar. Nothing is sent to us.</p>
              </div>
            </>
          ) : slipped ? (
            <>
              <p className="font-semibold">That lets them off the hook</p>
              <button type="button" onClick={retry} className="mt-2 rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium">Try again</button>
            </>
          ) : (
            <p className="text-sm text-foreground/70">{note || (oneMove ? `Try ${saved.tries}.` : `Try ${saved.tries}. ${left} ${left === 1 ? "move" : "moves"} left to win.`)}</p>
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
        {done && shown === null && <PlayNow game={game} />}
        {done && shown === null && <Link to="/rush" className="text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">Puzzle Rush: 3 minutes</Link>}
        <Link to="/daily/archive" className="text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">Past puzzles</Link>
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

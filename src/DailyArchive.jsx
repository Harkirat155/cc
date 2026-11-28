import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { GAME_NAMES, gameForDate, todayUtc } from "@shared/daily.js";
import { FIRST_DAY, readStore } from "./Daily";
import { dayState, monthWeeks, monthsBetween } from "./dailyGrid";
import { tally } from "./lib/tally";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MARK = { connect4: "●●", ttt: "✕○", five: "◉◉" };
const STATE_MARK = { solved: "✓", tried: "…", "not tried": "" };
const STATE_CLASS = {
  solved: "border-emerald-600/40 bg-emerald-600/10",
  tried: "border-foreground/30 bg-foreground/5",
  "not tried": "border-foreground/15",
};
const month = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function Cell({ date, today, store }) {
  if (!date) return <td />;
  const day = Number(date.slice(8));
  if (date < FIRST_DAY || date > today) return <td className="p-0.5"><div className="flex min-h-11 items-start justify-start p-1 text-sm text-foreground/30">{day}</div></td>;
  const game = gameForDate(date);
  const state = dayState(date, store);
  const label = `${day} ${month(date.slice(0, 7)).split(" ")[0]}, ${GAME_NAMES[game]}, ${state}`;
  return (
    <td className="p-0.5">
      <Link to={date === today ? "/daily" : `/daily/${date}`} aria-label={label} title={label} className={`flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm leading-tight ${STATE_CLASS[state]}`}>
        <span className="font-medium">{day}</span>
        <span aria-hidden="true" className="text-[10px] text-foreground/60">{MARK[game]}{STATE_MARK[state]}</span>
      </Link>
    </td>
  );
}

function DailyArchive() {
  const today = todayUtc();
  const store = useMemo(() => readStore(), []);
  const months = monthsBetween(FIRST_DAY, today);
  const total = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / 86400000) + 1;
  const solved = store.days.filter((d) => d >= FIRST_DAY && d <= today).length;
  useEffect(() => { tally("cc", "daily_archive"); }, []);
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link to="/daily" className="self-start text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Daily puzzle</Link>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Past puzzles</h1>
          <p className="mt-2 text-foreground/70">Solved on this device: {solved} of {total} {total === 1 ? "day" : "days"}. Days in a row count solved days whenever you solved them, so solving a missed day later can extend your streak. This record stays on this device.</p>
          <p className="mt-2 text-sm text-foreground/60">●● Connect Four, ✕○ Tic-Tac-Toe, ◉◉ Five in a Row. ✓ solved, … tried.</p>
        </header>
        {months.map((ym) => (
          <section key={ym}>
            <h2 className="mb-1 text-lg font-semibold">{month(ym)}</h2>
            <table className="w-full table-fixed border-collapse">
              <thead><tr>{WEEKDAYS.map((w) => <th key={w} scope="col" className="pb-1 text-xs font-medium text-foreground/60">{w}</th>)}</tr></thead>
              <tbody>
                {monthWeeks(ym).map((week, i) => <tr key={i}>{week.map((d, j) => <Cell key={j} date={d} today={today} store={store} />)}</tr>)}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}

export default DailyArchive;

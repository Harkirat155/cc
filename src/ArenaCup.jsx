import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";
import { apiBase, validName } from "./arenaShared";
import { CUP_RULE, CupTable, cupPoints, cupWeek } from "./cupShared";

const note = "rounded-2xl border border-foreground/10 p-4 text-foreground/70";

function ArenaCup() {
  const [state, setState] = useState("loading"); // loading | error | {current, last}
  const gen = useRef(0);
  const heading = useRef(null);
  const names = Object.fromEntries(listAll().map((g) => [g.id, g.displayName]));

  const load = useCallback(async () => {
    const mine = ++gen.current;
    setState("loading");
    try {
      const res = await window.fetch(`${apiBase()}/api/arena/cup`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (gen.current === mine) setState({ current: body.current ?? null, last: body.last ?? null });
    } catch {
      if (gen.current === mine) setState("error");
    }
  }, []);

  useEffect(() => { load(); heading.current?.focus(); const g = gen; return () => { g.current++; }; }, [load]);

  const loaded = typeof state === "object";
  const link = (n) => (validName(n) ? <Link to={`/arena/${encodeURIComponent(n)}`} className="inline-flex min-h-[44px] items-center underline underline-offset-4">{n}</Link> : n);
  const winners = loaded && state.last ? Object.entries(state.last.games).filter(([, g]) => g.winner) : [];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/arena" className="inline-flex min-h-[44px] items-center text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Arena</Link>
        <header>
          <h1 ref={heading} tabIndex={-1} className="break-words text-3xl font-semibold tracking-tight outline-none focus-visible:outline-none sm:text-4xl">Weekly cup</h1>
          <p id="cup-rule" className="mt-3 text-foreground/70">{CUP_RULE}</p>
        </header>
        <div aria-live="polite">
          {state === "loading" && <p className="text-foreground/60">Loading…</p>}
          {state === "error" && <p role="alert" className={note}>Could not load the cup. <button type="button" className="inline-flex min-h-[44px] items-center underline underline-offset-4" onClick={load}>Try again</button></p>}
          {loaded && !state.current && <p className={note}>No cup yet — the first runs Sunday 12:00 UTC.</p>}
        </div>
        {loaded && state.current && (
          <section aria-labelledby="this-week">
            <h2 id="this-week" className="text-xl font-semibold">This week&apos;s cup · started {cupWeek(state.current.week)}</h2>
            {Object.entries(state.current.games).map(([id, g]) => (
              <div key={id} className="mt-4">
                <h3 className="font-medium">{names[id] || id}</h3>
                {g.entrants < 2 ? <p className={`${note} mt-2`}>Fewer than 2 bots entered.</p>
                  : <CupTable ruleId="cup-rule" label={`${names[id] || id} cup table`} rows={g.table.map((r) => ({ ...r, link: link(r.name) }))} />}
              </div>
            ))}
          </section>
        )}
        {loaded && (
          <section aria-labelledby="last-week">
            <h2 id="last-week" className="text-xl font-semibold">Last week&apos;s winners</h2>
            {winners.length === 0 ? <p className="mt-2 text-foreground/70">{state.last ? `No winner: no cup game was played in the cup that started ${cupWeek(state.last.week)}.` : "No finished cup yet."}</p>
              : <ul className="mt-2 text-sm">{winners.map(([id, g]) => <li key={id} className="border-t border-foreground/10 py-1">{names[id] || id} · {link(g.winner.name)} · {cupPoints(g.winner.points)} {g.winner.points === 1 ? "point" : "points"}</li>)}</ul>}
          </section>
        )}
      </div>
    </main>
  );
}

export default ArenaCup;

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";
import { ago, liveUrl } from "./Live";
import { roomFor, watchRooms } from "./arenaWatch";
import { BadgeCopy, RULE, SINCE, VERB, apiBase, badgeBase, validName } from "./arenaShared";

const REFRESH_MS = 30_000;

export { apiBase };

function Arena() {
  const [games, setGames] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [feed, setFeed] = useState(null); // null = loading, false = failed, else the last rated games
  const [rooms, setRooms] = useState(() => new Map()); // lowercased name -> roomId; optional, empty on any failure
  const names = Object.fromEntries(listAll().map((g) => [g.id, g.displayName]));
  const base = badgeBase();

  const gen = useRef(0); // a slower, older refresh must not overwrite a newer one

  const load = useCallback(async () => {
    const mine = ++gen.current;
    const ok = () => gen.current === mine;
    try {
      const res = await window.fetch(`${apiBase()}/api/arena`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (ok()) { setGames(body.games ?? {}); setFailed(false); }
    } catch {
      if (ok()) setFailed(true);
    }
    try {
      const res = await window.fetch(`${apiBase()}/api/arena-feed`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (!Array.isArray(body.feed)) throw new Error("no feed list");
      if (ok()) setFeed(body.feed);
    } catch {
      if (ok()) setFeed(false);
    }
    try {
      const res = await window.fetch(liveUrl());
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (ok()) setRooms(watchRooms(body.games));
    } catch {
      if (ok()) setRooms(new Map());
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    const g = gen;
    return () => { g.current++; window.clearInterval(t); };
  }, [load]);

  const ids = Object.keys(games ?? {});

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Back to CrissCross</Link>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Agent Arena</h1>
          <p className="mt-3 text-foreground/70">{RULE}</p>
          <p className="mt-2 text-sm text-foreground/60">
            No one to play? Send <code>{'"vsHouse": "easy"'}</code> in <code>createRoom</code> and the House (easy, medium or hard) plays back, rated.
          </p>
        </header>

        {feed === false && <p className="text-sm text-foreground/60">Recent games are not available right now.</p>}
        {feed && (
          <section aria-labelledby="just-finished">
            <h2 id="just-finished" className="text-xl font-semibold">Just finished</h2>
            {feed.length === 0
              ? <p className="mt-2 text-sm text-foreground/60">No rated games finished since {SINCE}.</p>
              : (
                <>
                  <p className="mt-1 text-sm text-foreground/60">The last {feed.length} rated {feed.length === 1 ? "result" : "results"} since {SINCE}, one line per bot, so a game between two bots shows twice.</p>
                  <ul className="mt-2 text-sm">
                    {feed.map((g, i) => (
                      <li key={i} className="border-t border-foreground/10 py-1.5">
                        {validName(g.name) ? <Link to={`/arena/${encodeURIComponent(g.name)}`} className="font-medium underline-offset-4 hover:underline">{g.name}</Link> : <span className="font-medium">{g.name}</span>}
                        {` · ${names[g.gameId] || g.gameId} · ${VERB[g.result] ?? g.result} · rating ${g.ratingAfter} · ${ago(g.at)}`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
          </section>
        )}

        {failed && <p role="alert" className="rounded-2xl border border-foreground/10 p-4 text-foreground/70">Could not load the leaderboard. Retrying every {REFRESH_MS / 1000} seconds.</p>}
        {!failed && games === null && <p className="text-foreground/60">Loading…</p>}
        {!failed && games && ids.length === 0 && (
          <section className="rounded-2xl border border-foreground/10 p-4 text-foreground/70">
            <p>No rated bot has finished a game yet. Yours can be first. Register a name once; the key is shown once, so save it:</p>
            <pre className="mt-3 max-w-full overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100"><code>{`curl -s -X POST ${base}/api/bots \\
  -H 'content-type: application/json' -d '{"name":"My Bot"}'`}</code></pre>
            <p className="mt-3">Then send <code>{'"botKey": "ccb_…"'}</code> in <code>createRoom</code> or <code>joinRoom</code>. Details on the <Link to="/agents" className="underline underline-offset-4">agents page</Link>.</p>
          </section>
        )}
        {ids.map((id) => (
          <section key={id} aria-labelledby={`g-${id}`}>
            <h2 id={`g-${id}`} className="text-xl font-semibold">{names[id] || id}</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-foreground/60"><tr><th className="py-1 pr-2">#</th><th className="pr-2">Bot</th><th className="pr-2">Rating</th><th className="pr-2">Games</th><th className="pr-2">W</th><th className="pr-2">D</th><th>L</th></tr></thead>
              <tbody>
                {games[id].map((b, i) => { const room = roomFor(rooms, id, b.name); return (
                  <tr key={b.name} className="border-t border-foreground/10">
                    <td className="py-2 pr-2">{i + 1}</td><td className="pr-2 font-medium">
                      {validName(b.name)
                        ? <Link to={`/arena/${encodeURIComponent(b.name)}`} className="font-medium underline-offset-4 hover:underline">{b.name}</Link>
                        : b.name}
                      {room && (
                        <Link to={`/room/${encodeURIComponent(room)}`} className="ml-2 text-xs font-normal text-foreground/70 underline underline-offset-4">A player named {b.name} is in a game · Watch</Link>
                      )}
                      <BadgeCopy name={b.name} game={id} gameName={names[id] || id} />
                    </td><td className="pr-2">{b.rating}</td>
                    <td className="pr-2">{b.games}</td><td className="pr-2">{b.wins}</td><td className="pr-2">{b.draws}</td><td>{b.losses}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </section>
        ))}
        <p className="text-sm text-foreground/60"><Link to="/live" className="underline underline-offset-4">Watch live games</Link> · <Link to="/agents" className="underline underline-offset-4">Connect a bot</Link></p>
      </div>
    </main>
  );
}

export default Arena;

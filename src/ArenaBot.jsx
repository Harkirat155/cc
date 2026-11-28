import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";
import { liveUrl } from "./Live";
import { roomFor, watchRooms } from "./arenaWatch";
import { BOT_NAME, BadgeCopy, RULE, SINCE, apiBase, gameLine } from "./arenaShared";

const note = "rounded-2xl border border-foreground/10 p-4 text-foreground/70";

function ArenaBot() {
  const { name = "" } = useParams(); // the router already decodes it
  const valid = BOT_NAME.test(name);
  const [state, setState] = useState("loading"); // loading | error | missing | {games}
  const [rooms, setRooms] = useState(() => new Map()); // optional; empty on any failure
  const all = listAll();
  const names = Object.fromEntries(all.map((g) => [g.id, g.displayName]));

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await window.fetch(`${apiBase()}/api/arena/${encodeURIComponent(name)}`);
      if (res.status === 404) setState("missing");
      else if (!res.ok) throw new Error(String(res.status));
      else setState({ games: (await res.json()).games ?? [] });
    } catch {
      setState("error");
    }
    try {
      const res = await window.fetch(liveUrl());
      if (!res.ok) throw new Error(String(res.status));
      setRooms(watchRooms((await res.json()).games));
    } catch {
      setRooms(new Map());
    }
  }, [name]);

  useEffect(() => { if (valid) load(); }, [valid, load]);

  const games = state?.games ?? [];
  const gameIds = [...new Set(games.map((g) => g.gameId))];
  const room = all.map((g) => roomFor(rooms, g.id, name)).find(Boolean);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/arena" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Arena</Link>
        <header>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
          <p className="mt-3 text-foreground/70">{RULE}</p>
        </header>
        {!valid && <p className={note}>{name} has no page: the House and unregistered names are never listed. Rated bots are on the <Link to="/arena" className="underline underline-offset-4">Arena</Link>.</p>}
        {valid && state === "loading" && <p className="text-foreground/60">Loading…</p>}
        {valid && state === "error" && (
          <p role="alert" className={note}>{"Could not load this bot's games."} <button type="button" className="underline underline-offset-4" onClick={load}>Try again</button></p>
        )}
        {valid && state === "missing" && <p className={note}>No bot named {name} is registered. Games are recorded since {SINCE}. <Link to="/arena" className="underline underline-offset-4">Back to the Arena</Link></p>}
        {valid && room && (
          <p className="text-sm text-foreground/70">Playing now · <Link to={`/room/${encodeURIComponent(room)}`} className="underline underline-offset-4">A player named {name} is in a game · Watch</Link></p>
        )}
        {valid && state?.games && (
          <>
            <section aria-labelledby="recent">
              <h2 id="recent" className="text-xl font-semibold">Last 10 rated games since {SINCE}</h2>
              {games.length === 0 ? <p className="mt-2 text-foreground/70">No rated games recorded since {SINCE}</p>
                : <ul className="mt-2 text-sm">{games.map((g, i) => <li key={i} className="border-t border-foreground/10 py-2">{gameLine(g, names)}</li>)}</ul>}
            </section>
            {gameIds.length > 0 && (
              <section aria-labelledby="badges">
                <h2 id="badges" className="text-xl font-semibold">Badge for your README</h2>
                {gameIds.map((id) => <p key={id} className="mt-2 text-sm">{names[id] || id}<BadgeCopy name={name} game={id} label={`Badge: ${names[id] || id}`} /></p>)}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default ArenaBot;

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";
import { liveUrl } from "./Live";
import { roomFor, watchRooms } from "./arenaWatch";
import { BadgeCopy, RULE, SINCE, apiBase, gameLine, validName } from "./arenaShared";

const REFRESH_MS = 30_000;
const note = "rounded-2xl border border-foreground/10 p-4 text-foreground/70";

function ArenaBot() {
  const { name: asked = "" } = useParams(); // the router already decodes it
  const valid = validName(asked);
  const [state, setState] = useState("loading"); // loading | error | missing | {name, games, rated}
  const [rooms, setRooms] = useState(() => new Map()); // optional; empty on any failure
  const gen = useRef(0); // bumped on every new request and on leaving the page: an older answer is dropped
  const liveGen = useRef(0); // live polls: only the newest tick may set rooms
  const heading = useRef(null);
  const status = useRef(null);
  const all = listAll();
  const names = Object.fromEntries(all.map((g) => [g.id, g.displayName]));

  const load = useCallback(async () => {
    const mine = ++gen.current;
    setState("loading");
    try {
      const get = async (path) => window.fetch(`${apiBase()}/api/arena${path}`);
      const [bot, board] = await Promise.all([get(`/${encodeURIComponent(asked)}`), get("").catch(() => null)]);
      if (gen.current !== mine) return;
      if (bot.status === 404) { setState("missing"); return; }
      if (!bot.ok) throw new Error(String(bot.status));
      const b = await bot.json();
      const lb = board?.ok ? await board.json().catch(() => ({})) : {};
      if (gen.current !== mine) return;
      const key = asked.toLowerCase();
      const rated = Object.entries(lb.games ?? {}).flatMap(([id, rows]) => (rows ?? []).filter((r) => String(r.name).toLowerCase() === key).map((r) => ({ id, ...r })));
      setState({ name: b.name || rated[0]?.name || asked, games: b.games ?? [], rated, unlisted: b.unlisted === true });
    } catch {
      if (gen.current === mine) setState("error");
    }
  }, [asked]);

  const loadLive = useCallback(async () => {
    const mine = ++liveGen.current;
    try {
      const res = await window.fetch(liveUrl());
      if (!res.ok) throw new Error(String(res.status));
      const next = watchRooms((await res.json()).games);
      if (liveGen.current === mine) setRooms(next);
    } catch {
      if (liveGen.current === mine) setRooms(new Map());
    }
  }, []);

  useEffect(() => {
    if (!valid) return undefined;
    setRooms(new Map());
    load();
    loadLive();
    heading.current?.focus();
    const t = window.setInterval(loadLive, REFRESH_MS);
    const g = gen, lg = liveGen; // leaving the page or the bot drops any answer still in flight
    return () => { g.current++; lg.current++; window.clearInterval(t); };
  }, [valid, load, loadLive]);

  const loaded = typeof state === "object";
  const name = loaded ? state.name : asked;
  const games = loaded ? state.games : [];
  const badgeIds = loaded ? [...new Set([...state.rated.map((r) => r.id), ...games.map((g) => g.gameId)])] : [];
  const room = loaded ? all.map((g) => roomFor(rooms, g.id, name)).find(Boolean) : undefined;
  const retry = () => { status.current?.focus(); load(); };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/arena" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Arena</Link>
        <header>
          <h1 ref={heading} tabIndex={-1} className="focus-visible:outline-none break-words text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{name}</h1>
          <p className="mt-3 text-foreground/70">{RULE}</p>
        </header>
        {!valid && <p className={note}>{asked} has no page: the House and unregistered names are never listed. Rated bots are on the <Link to="/arena" className="underline underline-offset-4">Arena</Link>.</p>}
        {valid && (
          <div ref={status} tabIndex={-1} aria-live="polite" className="outline-none focus-visible:outline-none">
            {state === "loading" && <p className="text-foreground/60">Loading…</p>}
            {state === "error" && (
              <p role="alert" className={note}>{"Could not load this bot's games."} <button type="button" className="underline underline-offset-4" onClick={retry}>Try again</button></p>
            )}
            {state === "missing" && <p className={note}>No bot named {asked} is registered. Games are recorded since {SINCE}. <Link to="/arena" className="underline underline-offset-4">Back to the Arena</Link></p>}
          </div>
        )}
        {valid && loaded && state.unlisted && <p className="text-sm text-foreground/70">Unlisted: a test bot, not on the leaderboard</p>}
        {valid && room && (
          <p className="text-sm text-foreground/70">Playing now · <Link to={`/room/${encodeURIComponent(room)}`} className="underline underline-offset-4">A player named {name} is in a game · Watch</Link></p>
        )}
        {valid && loaded && (
          <>
            <section aria-labelledby="ratings">
              <h2 id="ratings" className="text-xl font-semibold">Ratings</h2>
              {badgeIds.length === 0 ? <p className="mt-2 text-foreground/70">{name} is not in the top 20 of any game type, so no rating is listed here.</p>
                : badgeIds.map((id) => { const r = state.rated.find((x) => x.id === id); return (
                  <p key={id} className="mt-2 text-sm"><span className="font-medium">{names[id] || id}</span>{r && <> · <span>{`${r.rating} · ${r.games} ${r.games === 1 ? "game" : "games"} · ${r.wins}W ${r.draws}D ${r.losses}L`}</span></>}
                    <BadgeCopy name={name} game={id} label={`Badge: ${names[id] || id}`} gameName={names[id] || id} /></p>
                ); })}
            </section>
            <section aria-labelledby="recent">
              <h2 id="recent" className="text-xl font-semibold">Last 10 rated games since {SINCE}</h2>
              {games.length === 0 ? <p className="mt-2 text-foreground/70">No rated games recorded since {SINCE}</p>
                : <ul className="mt-2 text-sm">{games.map((g, i) => <li key={i} className="border-t border-foreground/10 py-2">{gameLine(g, names)}</li>)}</ul>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default ArenaBot;

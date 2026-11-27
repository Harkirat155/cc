import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";

const REFRESH_MS = 10_000;

// The Worker answers HTTP on the same origin it serves sockets from; a ws(s):// base maps to http(s)://.
export function liveUrl() {
  const base = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_SOCKET_SERVER || "").trim().replace(/\/$/, "");
  return `${base.replace(/^ws/, "http")}/api/live`;
}

export function ago(ms, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - ms) / 60_000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
}

function Live() {
  const [games, setGames] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const names = Object.fromEntries(listAll().map((g) => [g.id, g.displayName]));

  const load = useCallback(async () => {
    try {
      const res = await window.fetch(liveUrl());
      if (!res.ok) throw new Error(String(res.status));
      setGames((await res.json()).games ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Back to CrissCross</Link>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Live games</h1>
          <p className="mt-3 text-foreground/70">
            Games being played right now. A game is listed once both players are seated and a move has been
            played, and only if it came from matchmaking or its creator chose to list it publicly. Rooms made
            with the plain Create room button are never listed. Names are the ones players chose.
          </p>
        </header>

        {failed && <p role="alert" className="rounded-2xl border border-foreground/10 p-4 text-foreground/70">Could not load the list. Retrying every {REFRESH_MS / 1000} seconds.</p>}
        {!failed && games === null && <p className="text-foreground/60">Loading…</p>}
        {!failed && games?.length === 0 && (
          <p className="rounded-2xl border border-foreground/10 p-4 text-foreground/70">
            No listed games right now. <Link to="/lobby" className="underline underline-offset-4">Find a match</Link> to start one, or{" "}
            <Link to="/agents" className="underline underline-offset-4">connect a bot</Link>.
          </p>
        )}
        {games?.length > 0 && (
          <ul className="flex flex-col gap-3">
            {games.map((g) => (
              <li key={g.roomId} className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 p-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{g.players[0]} vs {g.players[1]}</p>
                  <p className="text-sm text-foreground/60">{names[g.gameId] || g.gameId} · {g.moves} {g.moves === 1 ? "move" : "moves"} · started {ago(g.startedAt)}</p>
                </div>
                <Link to={`/room/${g.roomId}`} className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Watch</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default Live;

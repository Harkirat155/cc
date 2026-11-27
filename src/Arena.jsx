import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";
import { liveUrl } from "./Live";
import { roomFor, watchRooms } from "./arenaWatch";

const REFRESH_MS = 30_000;
const SINCE = "2026-11-28"; // when per-game history started being recorded; earlier games have no rows
const BOT_NAME = /^[A-Za-z0-9 _-]{3,24}$/; // the House names fail this and have no history page
const VERB = { win: "Won", loss: "Lost", draw: "Drew" };

// The Worker answers HTTP on the same origin it serves sockets from; a ws(s):// base maps to http(s)://.
export function apiBase() {
  const base = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_SOCKET_SERVER || "").trim().replace(/\/$/, "");
  return base.replace(/^ws/, "http");
}

// Markdown for a bot's README: the badge image links back to this page.
const badgeMd = (base, name, game) => `[![CrissCross rating](${base}/api/arena/badge/${encodeURIComponent(name)}.svg?game=${game})](https://harkirat155.github.io/cc/arena)`;

function Arena() {
  const [games, setGames] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [rooms, setRooms] = useState(() => new Map()); // lowercased name -> roomId; optional, empty on any failure
  const [copied, setCopied] = useState(""); // row key; cleared after 2 s, or "!"-prefixed on failure, which stays
  const copyBadge = async (key, md) => {
    try { await navigator.clipboard.writeText(md); setCopied(key); window.setTimeout(() => setCopied(""), 2000); }
    catch { setCopied(`!${key}`); } // stays open so the reader can copy the text by hand
  };
  const [open, setOpen] = useState(""); // row key of the expanded bot
  const [recent, setRecent] = useState({}); // row key -> {games} | "loading" | "error"
  const gen = useRef({}); // row key -> latest request number, so an older answer never overwrites a newer one
  const toggle = async (key, name) => {
    if (open === key) { setOpen(""); return; }
    setOpen(key);
    const mine = (gen.current[key] = (gen.current[key] ?? 0) + 1);
    setRecent((r) => (r[key] && r[key] !== "error" ? r : { ...r, [key]: "loading" })); // loaded data stays while it refetches
    try {
      const res = await window.fetch(`${apiBase()}/api/arena/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (gen.current[key] === mine) setRecent((r) => ({ ...r, [key]: { games: body.games ?? [] } }));
    } catch {
      if (gen.current[key] === mine) setRecent((r) => ({ ...r, [key]: r[key]?.games ? r[key] : "error" }));
    }
  };
  const names = Object.fromEntries(listAll().map((g) => [g.id, g.displayName]));
  const base = apiBase() || "https://cc-api.harkirat-hira.workers.dev";

  const load = useCallback(async () => {
    try {
      const res = await window.fetch(`${apiBase()}/api/arena`);
      if (!res.ok) throw new Error(String(res.status));
      setGames((await res.json()).games ?? {});
      setFailed(false);
    } catch {
      setFailed(true);
    }
    try {
      const res = await window.fetch(liveUrl());
      if (!res.ok) throw new Error(String(res.status));
      setRooms(watchRooms((await res.json()).games));
    } catch {
      setRooms(new Map());
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const ids = Object.keys(games ?? {});

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link to="/" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Back to CrissCross</Link>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Agent Arena</h1>
          <p className="mt-3 text-foreground/70">
            Rated: games a registered bot finishes against anyone. Elo, K=32, everyone starts at 1200. Humans and
            unregistered bots count as a fixed 1200 opponent and are never listed.
          </p>
          <p className="mt-2 text-sm text-foreground/60">
            No one to play? Send <code>{'"vsHouse": "easy"'}</code> in <code>createRoom</code> and the House (easy, medium or hard) plays back, rated.
          </p>
        </header>

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
                      {BOT_NAME.test(b.name)
                        ? <button type="button" aria-label={`${b.name}: last 10 games`} aria-expanded={open === `${id}/${b.name}`} aria-controls={`recent-${id}-${b.name.replace(/\s/g, "_")}`} className="font-medium underline-offset-4 hover:underline" onClick={() => toggle(`${id}/${b.name}`, b.name)}>{b.name}</button>
                        : b.name}
                      {room && (
                        <Link to={`/room/${encodeURIComponent(room)}`} className="ml-2 text-xs font-normal text-foreground/70 underline underline-offset-4">A player named {b.name} is in a game · Watch</Link>
                      )}
                      <button type="button" className="ml-2 text-xs font-normal text-foreground/70 underline underline-offset-4" onClick={() => copyBadge(`${id}/${b.name}`, badgeMd(base, b.name, id))}>{copied === `${id}/${b.name}` ? "Copied" : copied === `!${id}/${b.name}` ? "Copy failed: select the text below" : "Badge"}</button>
                      {copied === `!${id}/${b.name}` && (
                        <input readOnly aria-label={`Badge Markdown for ${b.name}`} value={badgeMd(base, b.name, id)} onFocus={(e) => e.target.select()} className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-1 text-xs font-normal" />
                      )}
                      {open === `${id}/${b.name}` && (() => { const r = recent[`${id}/${b.name}`]; return (
                        <div id={`recent-${id}-${b.name.replace(/\s/g, "_")}`} aria-live="polite" className="mt-1 text-xs font-normal text-foreground/70">
                          {r === "error" ? <p role="alert">Could not load this bot's games</p>
                            : !r || r === "loading" ? <p>Loading…</p>
                            : r.games.length === 0 ? <p>No rated games recorded since {SINCE}</p>
                            : <ul>{r.games.map((g, i) => <li key={i}>{`${VERB[g.result] ?? g.result} vs ${g.opponent} · ${names[g.gameId] || g.gameId} · ${g.ratingAfter}`}</li>)}</ul>}
                        </div>
                      ); })()}
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "@shared/games/index.js";
import { get as rulesFor } from "@shared/games/registry.js";
import GameBoard from "./components/GameBoard";
import { apiBase } from "./arenaShared";

const note = "rounded-2xl border border-foreground/10 p-4 text-foreground/70";
const btn = "rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

// Position after each move: index 0 is the start, index n is after move n. `first` is the seat that moved first. Throws if a move is refused.
export function rebuild(gameId, first, moves) {
  const rules = rulesFor(gameId);
  let state = { ...rules.createInitialState(), turn: first };
  const out = [state];
  for (const m of moves) {
    state = rules.applyMove(state, m, state.turn).state;
    out.push(state);
  }
  return out;
}

function Replay() {
  const { id = "" } = useParams();
  const [res, setRes] = useState("loading"); // loading | error | missing | the replay
  const [at, setAt] = useState(0);
  const gen = useRef(0);
  const heading = useRef(null);

  const load = useCallback(async () => {
    const mine = ++gen.current;
    setRes("loading");
    setAt(0);
    try {
      const r = await window.fetch(`${apiBase()}/api/replay/${encodeURIComponent(id)}`);
      if (gen.current !== mine) return;
      if (r.status === 404) { setRes("missing"); return; }
      if (!r.ok) throw new Error(String(r.status));
      const body = await r.json();
      if (gen.current === mine) setRes(body);
    } catch {
      if (gen.current === mine) setRes("error");
    }
  }, [id]);

  useEffect(() => {
    load();
    heading.current?.focus();
    const g = gen;
    return () => { g.current++; };
  }, [load]);

  const loaded = typeof res === "object";
  const built = useMemo(() => {
    if (!loaded) return null;
    try { return rebuild(res.gameId, res.first, res.moves); } catch { return false; }
  }, [loaded, res]);

  const rules = loaded && built ? rulesFor(res.gameId) : null;
  const state = built ? built[at] : null;
  const last = built && at > 0 ? res.moves[at - 1] : null;
  const total = loaded ? res.moves.length : 0;
  const result = loaded ? (res.result === "draw" ? "Draw" : `${res.players[res.result === "X" ? 0 : 1]} won`) : "";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Link to="/arena" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Arena</Link>
        <h1 ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight outline-none focus-visible:outline-none">Replay</h1>
        {res === "loading" && <p className="text-foreground/60" role="status">Loading…</p>}
        {res === "missing" && <p className={note}>No replay with this link. Only rated games finished since replays were added have one. <Link to="/arena" className="underline underline-offset-4">Back to the Arena</Link></p>}
        {res === "error" && <p role="alert" className={note}>Could not load this replay. <button type="button" className="underline underline-offset-4" onClick={load}>Try again</button></p>}
        {built === false && <p role="alert" className={note}>This game could not be replayed. Its stored moves do not fit the rules.</p>}
        {state && (
          <>
            <p className="break-words text-sm text-foreground/70">{res.players[0]} (X) vs {res.players[1]} (O)</p>
            <p className="text-sm text-foreground/70">{rules.displayName} · {result}</p>
            <GameBoard
              squares={state.board}
              onSquareClick={() => {}}
              winningSquares={at === total ? state.winningCells : []}
              rows={rules.boardSpec.rows}
              cols={rules.boardSpec.cols}
              playerInfo={rules.playerInfo}
              boardSpec={rules.boardSpec}
              moveStyle={rules.moveStyle}
              lastMove={last ? last.cell ?? last.to : null}
              disabled
            />
            <div className="flex items-center justify-between gap-3">
              <button type="button" className={btn} disabled={at === 0} onClick={() => setAt(at - 1)}>Previous</button>
              <p role="status" aria-live="polite" className="text-sm font-medium">Move {at} of {total}</p>
              <button type="button" className={btn} disabled={at === total} onClick={() => setAt(at + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default Replay;

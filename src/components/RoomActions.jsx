import React, { useEffect, useState } from "react";
import { tally } from "../lib/tally";

// Four fixed reactions, never free text. Must match EMOTES in worker/src/room.ts.
export const EMOTES = [
  ["👍", "thumbs up"],
  ["😮", "surprised"],
  ["😅", "relieved"],
  ["🤝", "handshake"],
];
const EMOTE_COOLDOWN_MS = 2000; // matches the server's 1 per 2 s per seat limit

const btn =
  "inline-flex h-9 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 text-xs font-medium text-foreground transition hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50";
const danger = "border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-300";

// Resign, draw offers and quick emotes for a seated player. In flow under the board, so it never covers it.
const RoomActions = ({ gameState, socketId, roster, onAction, reactions = true }) => {
  const [confirming, setConfirming] = useState(false);
  const [cooling, setCooling] = useState(false);
  const active = gameState?.status === "active" && Boolean(roster?.X && roster?.O);
  const offerer = gameState?.drawOfferer || null;
  const mine = Boolean(offerer && offerer === socketId);

  // Any new board (a move, a reset, a switch) disarms a pending resign, so one click never resigns a fresh game.
  useEffect(() => {
    setConfirming(false);
  }, [active, offerer, gameState?.board]);
  useEffect(() => {
    if (!cooling) return undefined;
    const t = setTimeout(() => setCooling(false), EMOTE_COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [cooling]);

  const sendEmote = (e) => {
    setCooling(true);
    onAction("emote", { emote: e });
    tally("cc", "react");
  };

  if (!socketId || (roster?.X !== socketId && roster?.O !== socketId)) return null; // spectators get no controls

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-3" aria-label="Room actions">
      {active && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {offerer ? (
            mine ? (
              <>
                <span className="text-xs text-muted-foreground">Draw offered</span>
                <button type="button" className={btn} onClick={() => onAction("cancelDrawOffer")}>Cancel offer</button>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Opponent offers a draw</span>
                <button type="button" className={btn} onClick={() => onAction("acceptDraw")}>Accept</button>
                <button type="button" className={btn} onClick={() => onAction("declineDraw")}>Decline</button>
              </>
            )
          ) : confirming ? (
            <>
              <button type="button" className={`${btn} ${danger}`} onClick={() => { setConfirming(false); onAction("resign"); }}>Confirm resign</button>
              <button type="button" className={btn} onClick={() => setConfirming(false)}>Keep playing</button>
            </>
          ) : (
            <>
              <button type="button" className={`${btn} ${danger}`} onClick={() => setConfirming(true)}>Resign</button>
              <button type="button" className={btn} onClick={() => onAction("offerDraw")}>Offer draw</button>
            </>
          )}
        </div>
      )}
      {reactions && (
        <div className="flex items-center justify-center gap-1" role="group" aria-label="Quick reactions">
          {EMOTES.map(([e, name]) => (
            <button
              key={e}
              type="button"
              disabled={cooling}
              onClick={() => sendEmote(e)}
              aria-label={`Send ${name}`}
              className="h-11 w-11 rounded-full text-xl transition hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default RoomActions;

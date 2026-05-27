import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "./ui/Tooltip";
import Button from "./ui/Button";

const ResultModal = ({
  result,
  onAcceptRematch,
  onLeaveRoom,
  player,
  roster,
  newGameRequester,
  requestNewGame,
  socketId,
  newGameRequestedAt,
  cancelNewGameRequest,
  rematchTimeoutSec = 20,
}) => {
  const isRequester = Boolean(
    newGameRequester && socketId && newGameRequester === socketId
  );
  const someoneRequested = Boolean(newGameRequester);
  const [now, setNow] = useState(() => Date.now());

  const opponentSeat = player === "X" ? "O" : "X";
  const opponentSocketId = roster?.[opponentSeat];
  const opponentName = roster?.[`${opponentSeat}Name`];
  const isOpponentPresent = Boolean(opponentSocketId);

  const deadline = useMemo(() => {
    if (!someoneRequested) return null;
    const startedAt = newGameRequestedAt || Date.now();
    return startedAt + rematchTimeoutSec * 1000;
  }, [someoneRequested, newGameRequestedAt, rematchTimeoutSec]);

  const remainingSec = useMemo(() => {
    if (!deadline) return null;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  }, [deadline, now]);

  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (remainingSec === 0 && someoneRequested) {
      cancelNewGameRequest?.();
    }
  }, [remainingSec, someoneRequested, cancelNewGameRequest]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (isRequester) cancelNewGameRequest?.();
      }
      if (e.key === "Enter") {
        if (someoneRequested && !isRequester) onAcceptRematch?.();
        else if (!someoneRequested && isOpponentPresent) requestNewGame?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isRequester,
    isOpponentPresent,
    someoneRequested,
    onAcceptRematch,
    requestNewGame,
    cancelNewGameRequest,
  ]);

  const requestStatus = someoneRequested
    ? isRequester
      ? "Waiting for your opponent to accept."
      : "Your opponent wants another round."
    : isOpponentPresent
    ? "Send a rematch request when you're ready."
    : "Your opponent left the room.";
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 animate-fadeIn bg-foreground/15 backdrop-blur-sm"
        aria-hidden
      />

      <div className="relative w-full max-w-sm animate-modal-enter">
        <div className="rounded-3xl border border-foreground/10 bg-card/85 px-6 py-5 text-foreground shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75 sm:px-7 sm:py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Rematch
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {result}
              </h2>
              <p className="text-sm text-muted-foreground">{requestStatus}</p>
            </div>

            <div className="w-full">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                  isOpponentPresent
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {isOpponentPresent ? (
                    <>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </span>
                <span>
                  {isOpponentPresent
                    ? `${opponentName || "Opponent"} is still here`
                    : "Opponent left the room"}
                </span>
              </div>
            </div>

            {someoneRequested && (
              <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-muted-foreground">
                <span className="truncate">
                  {isRequester
                    ? "Waiting for opponent…"
                    : "Your opponent requested a rematch"}
                </span>
                {typeof remainingSec === "number" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/10 bg-background/60 px-2 py-0.5 text-xs text-foreground">
                    ⏱ {remainingSec}s
                  </span>
                )}
              </div>
            )}

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {!someoneRequested && (
                <>
                  <Tooltip 
                    content={isOpponentPresent ? "Ask your opponent to play again" : "Opponent has left the room"} 
                    side="top"
                  >
                    <Button
                      className="h-11 w-full"
                      onClick={isOpponentPresent ? requestNewGame : undefined}
                      disabled={!isOpponentPresent}
                      aria-disabled={!isOpponentPresent}
                    >
                      Request rematch
                    </Button>
                  </Tooltip>
                  <Tooltip content="Exit this multiplayer room" side="top">
                    <Button variant="danger" className="h-11 w-full" onClick={onLeaveRoom}>
                      Leave room
                    </Button>
                  </Tooltip>
                </>
              )}

              {someoneRequested && !isRequester && (
                <>
                  <Tooltip content="Accept the rematch and start playing" side="top">
                    <Button variant="success" className="h-11 w-full" onClick={onAcceptRematch}>
                      Accept rematch
                    </Button>
                  </Tooltip>
                  <Tooltip content="Exit this multiplayer room" side="top">
                    <Button variant="danger" className="h-11 w-full" onClick={onLeaveRoom}>
                      Leave room
                    </Button>
                  </Tooltip>
                </>
              )}

              {someoneRequested && isRequester && (
                <Tooltip content="Withdraw your rematch request" side="top">
                  <Button
                    variant="neutral"
                    className="h-11 w-full sm:col-span-2"
                    onClick={cancelNewGameRequest}
                  >
                    Cancel request
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultModal;

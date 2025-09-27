import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "./ui/Tooltip";

const ResultModal = ({
  result,
  onStartNewLocal, // original resetGame for initiator or local
  // onJoinNewGame, // opponent joins after initiator resets (handled by onStartNewLocal)
  onLeaveRoom,
  isMultiplayer,
  // player,
  newGameRequester,
  requestNewGame,
  socketId,
  // optional: timestamp when request was created (ms since epoch)
  newGameRequestedAt,
  // optional: cancel function (for requester)
  cancelNewGameRequest,
  // configurable timeout in seconds (default 20)
  rematchTimeoutSec = 20,
}) => {
  const isRequester =
    isMultiplayer &&
    newGameRequester &&
    socketId &&
    newGameRequester === socketId;
  const someoneRequested = isMultiplayer && !!newGameRequester;
  const [now, setNow] = useState(Date.now());

  // Countdown logic only when someone has requested
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

  // Auto-expire UI if countdown hits 0 (requester can re-request)
  useEffect(() => {
    if (remainingSec === 0 && isMultiplayer && someoneRequested) {
      // If cancel is available, trigger to clear state; else rely on server/gameUpdate
      cancelNewGameRequest?.();
    }
  }, [remainingSec, isMultiplayer, someoneRequested, cancelNewGameRequest]);

  // Close on Escape, accept on Enter when focused on primary action
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        // If requester, cancel; otherwise just leave modal as is
        if (isRequester) cancelNewGameRequest?.();
      }
      if (e.key === "Enter") {
        if (!isMultiplayer) onStartNewLocal?.();
        else if (someoneRequested && !isRequester) onStartNewLocal?.();
        else if (!someoneRequested) requestNewGame?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isRequester,
    isMultiplayer,
    someoneRequested,
    onStartNewLocal,
    requestNewGame,
    cancelNewGameRequest,
  ]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dimmed, softly blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        aria-hidden
      ></div>

      {/* Card with glassmorphism */}
      <div className="relative max-w-sm w-full">
        <div className="group rounded-2xl border border-white/15 dark:border-white/10 bg-white/25 dark:bg-white/10 shadow-2xl backdrop-blur-xl px-6 py-5 sm:px-7 sm:py-6 transition-transform duration-200 will-change-transform">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {result}
            </h2>

            {/* Multiplayer state messaging */}
            {isMultiplayer && someoneRequested && (
              <div className="w-full flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span className="truncate">
                  {isRequester
                    ? "Waiting for opponent…"
                    : "Your opponent requested a rematch"}
                </span>
                {typeof remainingSec === "number" && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/40 dark:bg-white/20 px-2 py-0.5 text-xs text-gray-800 dark:text-gray-100">
                    ⏱ {remainingSec}s
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!isMultiplayer && (
                <Tooltip content="Play another local game" side="top">
                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white h-11 px-4 transition-colors sm:col-span-2 justify-self-center"
                    onClick={onStartNewLocal}
                  >
                    Start new game
                  </button>
                </Tooltip>
              )}

              {isMultiplayer && !someoneRequested && (
                <>
                  <Tooltip content="Ask your opponent to play again" side="top">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white h-11 px-4 transition-colors"
                      onClick={requestNewGame}
                    >
                      Request rematch
                    </button>
                  </Tooltip>
                  <Tooltip content="Exit this multiplayer room" side="top">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-red-500/90 hover:bg-red-500 text-white h-11 px-4 transition-colors"
                      onClick={onLeaveRoom}
                    >
                      Leave room
                    </button>
                  </Tooltip>
                </>
              )}

              {isMultiplayer && someoneRequested && !isRequester && (
                <>
                  <Tooltip content="Accept the rematch and start playing" side="top">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white h-11 px-4 transition-colors"
                      onClick={onStartNewLocal}
                    >
                      Accept rematch
                    </button>
                  </Tooltip>
                  <Tooltip content="Exit this multiplayer room" side="top">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-red-500/90 hover:bg-red-500 text-white h-11 px-4 transition-colors"
                      onClick={onLeaveRoom}
                    >
                      Leave room
                    </button>
                  </Tooltip>
                </>
              )}

              {isMultiplayer && someoneRequested && isRequester && (
                <Tooltip content="Withdraw your rematch request" side="top">
                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-gray-700/80 hover:bg-gray-700 text-white h-11 px-4 transition-colors col-span-1 sm:col-span-2"
                    onClick={cancelNewGameRequest}
                  >
                    Cancel request
                  </button>
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

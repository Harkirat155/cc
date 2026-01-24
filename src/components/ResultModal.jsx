import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "./ui/Tooltip";

const ResultModal = ({
  result,
  onStartNewLocal, // original resetGame for initiator or local
  // onJoinNewGame, // opponent joins after initiator resets (handled by onStartNewLocal)
  onLeaveRoom,
  isMultiplayer,
  player, // 'X' or 'O'
  roster, // { X: socketId|null, O: socketId|null, XName, OName, spectators }
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

  // Determine opponent presence
  const opponentSeat = player === 'X' ? 'O' : 'X';
  const opponentSocketId = roster?.[opponentSeat];
  const opponentName = roster?.[`${opponentSeat}Name`];
  const isOpponentPresent = isMultiplayer && !!opponentSocketId;

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
  // Determine if this is a win (not draw)
  const isWin = result && !result.toLowerCase().includes('draw');
  const celebrationParticles = useMemo(() => {
    if (!isWin) return [];
    return [...Array(12)].map((_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      top: `${20 + Math.random() * 40}%`,
      color: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][i % 5],
      delay: `${i * 0.1}s`,
      opacity: 0.7,
    }));
  }, [isWin, result]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dimmed, softly blurred backdrop with fade-in */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fadeIn"
        aria-hidden
      ></div>

      {/* Celebration particles for wins */}
      {isWin && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {celebrationParticles.map((particle) => (
            <span
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-celebrate"
              style={{
                left: particle.left,
                top: particle.top,
                backgroundColor: particle.color,
                animationDelay: particle.delay,
                opacity: particle.opacity,
              }}
            />
          ))}
        </div>
      )}

      {/* Card with glassmorphism and entrance animation */}
      <div className="relative max-w-sm w-full animate-modal-enter">
        <div className={`group rounded-2xl border border-white/15 dark:border-white/10 bg-white/25 dark:bg-white/10 shadow-2xl backdrop-blur-xl px-6 py-5 sm:px-7 sm:py-6 transition-transform duration-200 will-change-transform ${isWin ? 'animate-celebrate' : ''}`}>
          <div className="flex flex-col items-center text-center gap-4">
            {/* Result icon */}
            <div className={`text-4xl mb-1 ${isWin ? 'animate-gentle-bounce' : ''}`}>
              {result?.toLowerCase().includes('draw') ? '🤝' : '🎉'}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {result}
            </h2>

            {/* Opponent presence indicator for multiplayer */}
            {isMultiplayer && (
              <div className="w-full">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    isOpponentPresent
                      ? 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/40'
                      : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/40'
                  }`}
                >
                  {/* Animated presence dot */}
                  <span className="relative flex h-2 w-2">
                    {isOpponentPresent ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    )}
                  </span>
                  <span>
                    {isOpponentPresent
                      ? `${opponentName || 'Opponent'} is still here`
                      : 'Opponent left the room'}
                  </span>
                </div>
              </div>
            )}

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
                  <Tooltip 
                    content={isOpponentPresent ? "Ask your opponent to play again" : "Opponent has left the room"} 
                    side="top"
                  >
                    <button
                      className={`inline-flex items-center justify-center rounded-lg h-11 px-4 transition-colors ${
                        isOpponentPresent
                          ? 'bg-blue-600/90 hover:bg-blue-600 text-white'
                          : 'bg-gray-400/60 text-gray-500 dark:bg-gray-600/40 dark:text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={isOpponentPresent ? requestNewGame : undefined}
                      disabled={!isOpponentPresent}
                      aria-disabled={!isOpponentPresent}
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

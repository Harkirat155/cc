import React from "react";
import { createPortal } from "react-dom";
import { X, Check, Grid3X3, LayoutGrid } from "lucide-react";
import { GAME_MODES } from "../utils/gameMode";

/**
 * Persistent toast for mode change requests in multiplayer games.
 * Shows to the player who receives a mode change request from their opponent.
 */
const ModeChangeToast = ({
  modeChangeRequest,
  socketId,
  onAccept,
  onReject,
  onCancel,
}) => {
  const isBrowser = typeof document !== "undefined";

  if (!isBrowser || !modeChangeRequest) return null;

  const isRequester = modeChangeRequest.requesterSocketId === socketId;
  const newMode = modeChangeRequest.newMode;
  const modeConfig = GAME_MODES[newMode];
  const modeName = modeConfig?.name || newMode;
  const ModeIcon = newMode === "ultimate" ? LayoutGrid : Grid3X3;

  // Requester sees a different message
  if (isRequester) {
    return createPortal(
      <div
        className="pointer-events-none fixed left-1/2 top-20 z-[65] w-full max-w-[min(92vw,420px)] -translate-x-1/2 px-4"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto relative overflow-hidden rounded-3xl border border-amber-300/80 bg-amber-50/95 px-4 py-3 text-amber-800 shadow-[0_25px_60px_-28px_rgba(120,53,15,0.25)] ring-1 ring-amber-200/70 backdrop-blur-xl dark:border-amber-700/50 dark:bg-amber-950/90 dark:text-amber-100 dark:ring-amber-800/50">
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/60 bg-amber-100/60 text-amber-600 transition-colors duration-200 hover:bg-amber-200/80 hover:text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/70 dark:text-amber-400 dark:hover:bg-amber-900/80"
            aria-label="Cancel request"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-200/70 dark:bg-amber-800/50">
              <ModeIcon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-relaxed tracking-tight">
                Waiting for opponent to accept...
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Switch to {modeName}
              </p>
            </div>
          </div>
          {/* Pulsing indicator */}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 opacity-70"
            style={{
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>,
      document.body
    );
  }

  // Receiver sees accept/reject buttons
  return createPortal(
    <div
      className="pointer-events-none fixed left-1/2 top-20 z-[65] w-full max-w-[min(92vw,420px)] -translate-x-1/2 px-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-auto relative overflow-hidden rounded-3xl border border-indigo-300/80 bg-indigo-50/95 px-4 py-3 text-indigo-800 shadow-[0_25px_60px_-28px_rgba(67,56,202,0.25)] ring-1 ring-indigo-200/70 backdrop-blur-xl dark:border-indigo-700/50 dark:bg-indigo-950/90 dark:text-indigo-100 dark:ring-indigo-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-200/70 dark:bg-indigo-800/50">
            <ModeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-relaxed tracking-tight">
              Opponent wants to switch modes
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              Change to {modeName} ({modeConfig?.size}×{modeConfig?.size}, {modeConfig?.streak} in a row)
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100/80 px-4 py-2 text-sm font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-200 hover:shadow-md dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-800/60"
          >
            <Check size={16} />
            Accept
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-100/80 px-4 py-2 text-sm font-semibold text-rose-700 transition-all duration-200 hover:bg-rose-200 hover:shadow-md dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-800/60"
          >
            <X size={16} />
            Reject
          </button>
        </div>
        {/* Animated gradient bar */}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 opacity-70"
          style={{
            animation: "shimmer 2s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ModeChangeToast;

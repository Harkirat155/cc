import React from "react";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.js";
import { AnimatePresence, motion } from "motion/react";
import useReducedMotion from "../hooks/useReducedMotion";
import { getGamePalette } from "./games/palette";

function resolveWinnerSlot(winner, winnerSlot, playerInfo) {
  if (Number.isInteger(winnerSlot)) return winnerSlot;
  const index = playerInfo?.findIndex((player) => player?.label === winner);
  return index === 1 ? 1 : 0;
}

const WinnerCard = ({
  winner,
  winnerSlot,
  gameId,
  playerInfo,
  onReset,
  onRequestNewGame,
  isMultiplayer = false,
  disabled = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isVisible = Boolean(winner);
  const isDraw = winner === "draw" || winnerSlot === "draw";
  const palette = getGamePalette(gameId);
  const slot = resolveWinnerSlot(winner, winnerSlot, playerInfo);
  const accent = slot === 1 ? palette.p2 : palette.p1;
  const playerLabel = playerInfo?.[slot]?.label || winner || accent.label;
  const action = isMultiplayer ? onRequestNewGame || onReset : onReset;
  const actionLabel = isMultiplayer ? "Request rematch" : "Start new game";

  const motionState = prefersReducedMotion
    ? { opacity: 1, x: "-50%" }
    : { opacity: 1, x: "-50%", y: 0, scale: 1 };
  const motionHidden = prefersReducedMotion
    ? { opacity: 0, x: "-50%" }
    : { opacity: 0, x: "-50%", y: 12, scale: 0.96 };

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          role="status"
          aria-live="polite"
          className="absolute -bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-foreground/10 bg-background/80 p-1.5 pr-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] sm:-bottom-8 sm:gap-4 sm:p-2 sm:pr-6"
          initial={motionHidden}
          animate={motionState}
          exit={motionHidden}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <button
            type="button"
            onClick={action}
            disabled={disabled}
            aria-label={actionLabel}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-foreground/10 transition hover:scale-105 hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-12 sm:w-12"
          >
            <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>
          <span className="min-w-0 whitespace-nowrap text-xs font-medium tracking-tight text-foreground sm:text-sm">
            {isDraw ? (
              "Match ended in a draw"
            ) : (
              <>
                <span className={accent.color}>{playerLabel}</span> wins!
              </>
            )}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default WinnerCard;

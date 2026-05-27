import React, { memo } from "react";
import Crown from "lucide-react/dist/esm/icons/crown.js";
import {
  cx,
  paletteForValue,
  revealClasses,
  samePieceValue,
  samePlayerInfo,
} from "./boardPresentationUtils";

const PIECE_BG = {
  red: "bg-red-500 dark:bg-red-400",
  amber: "bg-amber-400 dark:bg-amber-300",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
};

export const Piece = memo(function Piece({ piece, playerInfo, palette, reducedMotion }) {
  if (!piece || typeof piece !== "object") return null;
  const info = Array.isArray(playerInfo)
    ? playerInfo.find((p) => p.slot === piece.owner)
    : null;
  const paletteEntry = paletteForValue(piece, playerInfo, palette);
  const colorClass = paletteEntry?.piece || PIECE_BG[info?.color] || "bg-stone-500";

  return (
    <span
      className={cx(
        "relative flex h-6 w-6 items-center justify-center rounded-full border text-white sm:h-9 sm:w-9",
        revealClasses(reducedMotion),
        colorClass
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/4 top-1/5 h-1/4 w-1/3 rounded-full bg-white/35 blur-sm"
      />
      {piece.type === "king" && <Crown size={18} className="relative z-10 drop-shadow" />}
    </span>
  );
}, (prev, next) => (
  samePieceValue(prev.piece, next.piece) &&
  samePlayerInfo(prev.playerInfo, next.playerInfo) &&
  prev.palette === next.palette &&
  prev.reducedMotion === next.reducedMotion
));

export const ConnectPiece = memo(function ConnectPiece({ value, playerInfo, palette, isWinning, reducedMotion }) {
  const paletteEntry = paletteForValue(value, playerInfo, palette);
  const colorClass = paletteEntry?.piece || "bg-stone-500";

  return (
    <span
      className={cx(
        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 sm:h-12 sm:w-12",
        revealClasses(reducedMotion),
        colorClass,
        isWinning && "z-20 scale-110 ring-4 ring-foreground/20 ring-offset-2 ring-offset-background"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/4 top-1/5 h-1/4 w-1/3 rounded-full bg-white/35 blur-sm"
      />
    </span>
  );
}, (prev, next) => (
  prev.value === next.value &&
  samePlayerInfo(prev.playerInfo, next.playerInfo) &&
  prev.palette === next.palette &&
  prev.isWinning === next.isWinning &&
  prev.reducedMotion === next.reducedMotion
));

export const EmptyConnectSlot = memo(function EmptyConnectSlot() {
  return (
    <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-foreground/5 bg-foreground/5 shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all duration-300 dark:bg-black/40 dark:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] sm:h-12 sm:w-12">
      <span className="h-1 w-1 rounded-full bg-foreground/10" />
    </span>
  );
});

export const LegalTargetDot = memo(function LegalTargetDot() {
  return (
    <span className="absolute h-3 w-3 rounded-full bg-emerald-400/75 shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
  );
});

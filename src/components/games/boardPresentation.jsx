import React, { memo } from "react";
import Crown from "lucide-react/dist/esm/icons/crown.js";
import { motion } from "motion/react";

const PIECE_BG = {
  red: "bg-red-500 dark:bg-red-400",
  amber: "bg-amber-400 dark:bg-amber-300",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
};

const FALLBACK_SLOT = {
  X: 0,
  R: 0,
  Red: 0,
  O: 1,
  Y: 1,
  Yellow: 1,
};

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function slotForValue(value, playerInfo) {
  if (value && typeof value === "object") return Number.isInteger(value.owner) ? value.owner : null;
  if (Array.isArray(playerInfo)) {
    const exact = playerInfo.find((p) => p?.label === value);
    if (exact && Number.isInteger(exact.slot)) return exact.slot;
    const byInitial = playerInfo.find((p) => p?.label?.charAt(0) === value);
    if (byInitial && Number.isInteger(byInitial.slot)) return byInitial.slot;
  }
  return Object.prototype.hasOwnProperty.call(FALLBACK_SLOT, value) ? FALLBACK_SLOT[value] : null;
}

function paletteForValue(value, playerInfo, palette) {
  const slot = slotForValue(value, playerInfo);
  if (slot === 0) return palette?.p1;
  if (slot === 1) return palette?.p2;
  return null;
}

function samePieceValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return a.owner === b.owner && a.type === b.type;
}

function samePlayerInfo(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((player, index) => {
    const next = b[index];
    return player?.slot === next?.slot && player?.label === next?.label && player?.color === next?.color;
  });
}

export function revealProps(reducedMotion, targetScale = 1) {
  if (reducedMotion) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, scale: 0.72 },
    animate: { opacity: 1, scale: targetScale },
    transition: { type: "spring", stiffness: 420, damping: 26 },
  };
}

export const Piece = memo(function Piece({ piece, playerInfo, palette, reducedMotion }) {
  if (!piece || typeof piece !== "object") return null;
  const info = Array.isArray(playerInfo)
    ? playerInfo.find((p) => p.slot === piece.owner)
    : null;
  const paletteEntry = paletteForValue(piece, playerInfo, palette);
  const colorClass = paletteEntry?.piece || PIECE_BG[info?.color] || "bg-stone-500";

  return (
    <motion.span
      {...revealProps(reducedMotion)}
      className={cx(
        "relative flex h-6 w-6 items-center justify-center rounded-full border text-white sm:h-9 sm:w-9",
        colorClass
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/4 top-1/5 h-1/4 w-1/3 rounded-full bg-white/35 blur-sm"
      />
      {piece.type === "king" && <Crown size={18} className="relative z-10 drop-shadow" />}
    </motion.span>
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
    <motion.span
      {...revealProps(reducedMotion, isWinning ? 1.1 : 1)}
      className={cx(
        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 sm:h-12 sm:w-12",
        colorClass,
        isWinning && "z-20 scale-110 ring-4 ring-foreground/20 ring-offset-2 ring-offset-background"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/4 top-1/5 h-1/4 w-1/3 rounded-full bg-white/35 blur-sm"
      />
    </motion.span>
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

export function squareClasses({
  gameId,
  isWinning,
  isSelected,
  isLegalTarget,
  isDarkSquare,
  isColumnHighlighted,
  hasSelectionFlow,
  hasValue,
  isPressed,
}) {
  const base =
    "group relative flex aspect-square items-center justify-center border transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default";

  if (gameId === "connect4") {
    return cx(
      base,
      "rounded-2xl border-transparent bg-transparent p-1 sm:p-1.5",
      isColumnHighlighted
        ? "bg-foreground/[0.04]"
        : "hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04]",
      isWinning && "z-10",
      isPressed && "scale-95",
      hasValue ? "cursor-default" : "cursor-pointer"
    );
  }

  if (gameId === "checkers") {
    return cx(
      base,
      "h-8 w-8 rounded-none border-0 text-foreground shadow-none sm:h-12 sm:w-12",
      isDarkSquare
        ? "bg-foreground/[0.04] hover:bg-foreground/[0.06]"
        : "border-transparent bg-transparent",
      isSelected && "z-10 bg-foreground/[0.08] ring-2 ring-foreground/30",
      isLegalTarget && "bg-emerald-400/10 ring-2 ring-emerald-400/60",
      isPressed && "scale-95",
      hasSelectionFlow ? "cursor-pointer" : "cursor-default"
    );
  }

  return cx(
    base,
    "h-[4.5rem] w-[4.5rem] rounded-2xl border-foreground/5 bg-foreground/[0.03] text-4xl font-light text-foreground hover:bg-foreground/[0.06] min-[360px]:h-20 min-[360px]:w-20 sm:h-28 sm:w-28 sm:text-5xl",
    isWinning && "z-10 scale-105 border-foreground/20 bg-foreground/10 shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(255,255,255,0.1)]",
    isPressed && "scale-95",
    hasValue ? "cursor-default" : "cursor-pointer"
  );
}

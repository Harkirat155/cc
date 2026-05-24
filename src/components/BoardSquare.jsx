import React, { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

// Piece-color tokens, keyed by owner slot. Mirrors COLOR_CLASSES in
// ValueMark — pieces are rendered as filled discs whereas marks are glyphs.
const PIECE_BG = {
  red: "bg-red-500 dark:bg-red-400",
  amber: "bg-amber-400 dark:bg-amber-300",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
};

const Piece = ({ piece, playerInfo }) => {
  if (!piece || typeof piece !== "object") return null;
  const info = Array.isArray(playerInfo)
    ? playerInfo.find((p) => p.slot === piece.owner)
    : null;
  const colorClass = PIECE_BG[info?.color] || "bg-stone-500";
  return (
    <span
      className={`relative flex h-[68%] w-[68%] items-center justify-center rounded-full text-white shadow-md ring-2 ring-black/10 dark:ring-white/10 ${colorClass}`}
    >
      {piece.type === "king" && <Crown size={18} className="drop-shadow" />}
    </span>
  );
};

const BoardSquare = ({
  value,
  onClick,
  isWinning,
  index,
  rows = 3,
  cols = 3,
  playerInfo,
  isSelected = false,
  isLegalTarget = false,
  isDarkSquare = false,
  hasSelectionFlow = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const pressTimeoutRef = useRef(null);
  const row = typeof index === "number" ? Math.floor(index / cols) + 1 : null;
  const col = typeof index === "number" ? (index % cols) + 1 : null;
  void rows;
  const positionText = row && col ? `row ${row}, column ${col}` : "this square";
  const isPiece = value && typeof value === "object";
  const hasValue = isPiece || (typeof value === "string" && value !== "");
  const valueLabel = isPiece ? `${value.type} (slot ${value.owner})` : value;
  const tooltipMessage = hasValue
    ? `Square ${positionText} • ${valueLabel}${isWinning ? " (winning)" : ""}`
    : `Square ${positionText} • Click or tap`;

  const handleClick = () => {
    // In selection-style games (Checkers), a click is meaningful on a piece
    // we own OR on a legal target — let the parent decide. In placement
    // games, an occupied square is a no-op.
    if (!hasSelectionFlow && hasValue) return;
    setIsPressed(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
    onClick();
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
    }
    pressTimeoutRef.current = setTimeout(() => setIsPressed(false), 150);
  };

  useEffect(() => {
    return () => {
      if (pressTimeoutRef.current) {
        clearTimeout(pressTimeoutRef.current);
      }
    };
  }, []);

  // Background: dark-square games (Checkers) use a chessboard-style fill so
  // the unplayable squares read as inert. Otherwise keep the neutral tile.
  const bgClass = isDarkSquare
    ? "border-amber-900/40 bg-amber-900/30 dark:border-amber-100/10 dark:bg-amber-900/40"
    : "border-stone-200/80 bg-stone-50/90 dark:border-slate-700/70 dark:bg-slate-900/70";
  const cursorClass = hasSelectionFlow
    ? "cursor-pointer hover:-translate-y-0.5"
    : hasValue
    ? "cursor-not-allowed"
    : "cursor-pointer hover:-translate-y-1 hover:border-indigo-400/70 hover:bg-stone-100 hover:shadow-[0_20px_45px_-28px_rgba(99,102,241,0.45)] active:translate-y-0 active:scale-95";

  return (
    <Tooltip content={tooltipMessage}>
      <button
        type="button"
        className={`group relative flex aspect-square w-[clamp(40px,11vw,72px)] items-center justify-center rounded-2xl border text-4xl font-semibold text-stone-700 shadow-[0_15px_35px_-28px_rgba(28,25,23,0.45)] transition-all duration-200 ease-out dark:text-slate-100 ${bgClass} ${
          isWinning ? "ring-2 ring-indigo-400/80 dark:ring-emerald-400/70 animate-celebrate" : ""
        } ${isSelected ? "ring-2 ring-indigo-500 dark:ring-indigo-400" : ""} ${
          isLegalTarget ? "ring-2 ring-emerald-400 dark:ring-emerald-300" : ""
        } ${cursorClass} ${isPressed ? "scale-95" : ""}`}
        onClick={handleClick}
        aria-label={tooltipMessage}
        disabled={!hasSelectionFlow && Boolean(hasValue)}
      >
        {/* Subtle grid position hint for empty squares (placement games only) */}
        {!hasValue && !hasSelectionFlow && (
          <span className="absolute inset-0 flex items-center justify-center text-stone-300 dark:text-slate-700 text-2xl font-light opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {index + 1}
          </span>
        )}
        {isLegalTarget && !hasValue && (
          <span className="absolute h-3 w-3 rounded-full bg-emerald-400/70" />
        )}
        {isPiece ? (
          <Piece piece={value} playerInfo={playerInfo} />
        ) : (
          <span
            className={`transition-all duration-200 ${
              hasValue ? "scale-105" : "scale-95 text-stone-400 dark:text-slate-600"
            }`}
          >
            {hasValue ? <ValueMark value={value} playerInfo={playerInfo} /> : "·"}
          </span>
        )}
        {isPressed && (
          <span className="absolute inset-0 rounded-2xl bg-indigo-400/20 animate-ping" />
        )}
      </button>
    </Tooltip>
  );
};

export default BoardSquare;

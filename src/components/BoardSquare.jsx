import React, { useState } from "react";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

const BoardSquare = ({ value, onClick, isWinning, index }) => {
  const [isPressed, setIsPressed] = useState(false);
  const row = typeof index === "number" ? Math.floor(index / 3) + 1 : null;
  const col = typeof index === "number" ? (index % 3) + 1 : null;
  const positionText = row && col ? `row ${row}, column ${col}` : "this square";
  const tooltipMessage = value
    ? `Square ${positionText} • Mark ${value}${isWinning ? " (winning line)" : ""}`
    : `Square ${positionText} • Click or tap to place your mark`;

  const handleClick = () => {
    if (value) return;
    setIsPressed(true);
    // Trigger haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onClick();
    setTimeout(() => setIsPressed(false), 150);
  };

  return (
    <Tooltip content={tooltipMessage}>
      <button
        type="button"
        className={`relative flex aspect-square w-[clamp(70px,22vw,110px)] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-4xl font-semibold text-slate-800 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.75)] transition-all duration-200 ease-out dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 ${
          isWinning ? "ring-2 ring-indigo-400/80 dark:ring-emerald-400/70 animate-celebrate" : ""
        } ${value ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 hover:border-indigo-400/70 hover:bg-white hover:shadow-[0_20px_45px_-28px_rgba(99,102,241,0.6)] active:translate-y-0 active:scale-95"} ${isPressed ? "scale-95" : ""}`}
        onClick={handleClick}
        aria-label={tooltipMessage}
        disabled={Boolean(value)}
      >
        {/* Subtle grid position hint for empty squares */}
        {!value && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-200 dark:text-slate-700 text-2xl font-light opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {index + 1}
          </span>
        )}
        <span
          className={`transition-all duration-200 ${
            value ? "scale-105" : "scale-95 text-slate-300 dark:text-slate-600"
          }`}
        >
          {value ? <ValueMark value={value} /> : "·"}
        </span>
        {/* Ripple effect container */}
        {isPressed && (
          <span className="absolute inset-0 rounded-2xl bg-indigo-400/20 animate-ping" />
        )}
      </button>
    </Tooltip>
  );
};

export default BoardSquare;

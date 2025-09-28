import React from "react";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

const BoardSquare = ({ value, onClick, isWinning, index }) => {
  const row = typeof index === "number" ? Math.floor(index / 3) + 1 : null;
  const col = typeof index === "number" ? (index % 3) + 1 : null;
  const positionText = row && col ? `row ${row}, column ${col}` : "this square";
  const tooltipMessage = value
    ? `Square ${positionText} • Mark ${value}${isWinning ? " (winning line)" : ""}`
    : `Square ${positionText} • Click or tap to place your mark`;

  return (
    <Tooltip content={tooltipMessage}>
      <button
        type="button"
        className={`relative flex aspect-square w-[clamp(70px,22vw,110px)] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-4xl font-semibold text-slate-800 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.75)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-400/70 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 ${
          isWinning ? "ring-2 ring-indigo-400/80 dark:ring-emerald-400/70" : ""
        } ${value ? "cursor-not-allowed" : "cursor-pointer"}`}
        onClick={onClick}
        aria-label={tooltipMessage}
        disabled={Boolean(value)}
      >
        <span
          className={`transition-all duration-200 ${
            value ? "scale-105" : "scale-95 text-slate-400 dark:text-slate-500"
          }`}
        >
          {value ? <ValueMark value={value} /> : "•"}
        </span>
      </button>
    </Tooltip>
  );
};

export default BoardSquare;

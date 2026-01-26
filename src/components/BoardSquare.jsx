import React, { useEffect, useRef, useState } from "react";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

const BoardSquare = ({ value, onClick, isWinning, index, boardSize = 3 }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const pressTimeoutRef = useRef(null);
  const prevValueRef = useRef(value);
  const row = typeof index === "number" ? Math.floor(index / boardSize) + 1 : null;
  const col = typeof index === "number" ? (index % boardSize) + 1 : null;
  const positionText = row && col ? `row ${row}, column ${col}` : "this square";
  const tooltipMessage = value
    ? `Square ${positionText} • Mark ${value}${isWinning ? " (winning line)" : ""}`
    : `Square ${positionText} • Click or tap to place your mark`;

  // Animate new moves
  useEffect(() => {
    if (value && !prevValueRef.current) {
      setIsNew(true);
      const timer = setTimeout(() => setIsNew(false), 300);
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  const handleClick = () => {
    if (value) return;
    setIsPressed(true);
    // Trigger haptic feedback on supported devices
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

  // Responsive sizing based on board size
  const sizeClasses = boardSize <= 3
    ? "w-[clamp(70px,22vw,110px)]"
    : boardSize === 5
    ? "w-[clamp(50px,14vw,70px)]"
    : "w-[clamp(40px,12vw,60px)]";

  const textSizeClasses = boardSize <= 3
    ? "text-4xl"
    : boardSize === 5
    ? "text-2xl"
    : "text-xl";

  return (
    <Tooltip content={tooltipMessage}>
      <button
        type="button"
        className={`group relative flex aspect-square ${sizeClasses} items-center justify-center rounded-2xl border border-stone-200/80 bg-stone-50/90 ${textSizeClasses} font-semibold text-stone-700 shadow-[0_15px_35px_-28px_rgba(28,25,23,0.45)] transition-all duration-200 ease-out dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 ${
          isWinning ? "ring-2 ring-indigo-400/80 dark:ring-emerald-400/70 animate-celebrate" : ""
        } ${isNew ? "animate-scale-in" : ""} ${value ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 hover:border-indigo-400/70 hover:bg-stone-100 hover:shadow-[0_20px_45px_-28px_rgba(99,102,241,0.45)] active:translate-y-0 active:scale-95"} ${isPressed ? "scale-95" : ""}`}
        onClick={handleClick}
        aria-label={tooltipMessage}
        disabled={Boolean(value)}
      >
        {/* Subtle grid position hint for empty squares */}
        {!value && (
          <span className="absolute inset-0 flex items-center justify-center text-stone-300 dark:text-slate-700 text-2xl font-light opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {index + 1}
          </span>
        )}
        <span
          className={`transition-all duration-200 ${
            value ? "scale-105" : "scale-95 text-stone-400 dark:text-slate-600"
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

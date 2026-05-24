import React from "react";
import BoardSquare from "./BoardSquare";

// Tailwind requires literal class names (no string interpolation in JIT).
// Map a small whitelist of column counts to their utility class.
const GRID_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
};

const GameBoard = ({
  squares,
  onSquareClick,
  winningSquares,
  rows = 3,
  cols = 3,
  playerInfo,
  boardSpec,
  moveStyle = "place",
  selection = null,
  legalTargets = [],
}) => {
  const colsClass = GRID_COLS[cols] || GRID_COLS[3];
  // Wider boards (Connect Four, Checkers) need a roomier max-width.
  const maxWidthClass = cols >= 6
    ? "max-w-[min(96vw,640px)]"
    : "max-w-[min(90vw,420px)]";
  const isDark = Boolean(boardSpec?.dark);
  const hasSelectionFlow = moveStyle === "select-target";
  const legalTargetIndexes = new Set(
    (legalTargets || []).map((m) => (typeof m === "object" ? m.to : m))
  );

  return (
    <div className="relative" data-tour="board">
      <div className="pointer-events-none absolute inset-[-6%] -z-10 rounded-[36px] bg-gradient-to-br from-indigo-500/20 via-sky-500/8 to-emerald-400/20 opacity-50 blur-3xl dark:from-indigo-500/15 dark:via-slate-900/40 dark:to-emerald-500/20" />
      <div className={`relative mx-auto w-full ${maxWidthClass} overflow-hidden rounded-[28px] border border-stone-200/80 bg-stone-50/90 p-5 shadow-[0_25px_60px_-30px_rgba(28,25,23,0.35)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70`}>
        <div className={`grid ${colsClass} gap-3`}>
          {squares.map((square, index) => {
            const r = Math.floor(index / cols);
            const c = index % cols;
            const darkSquare = isDark && (r + c) % 2 === 1;
            return (
              <BoardSquare
                key={index}
                value={square}
                onClick={() => onSquareClick(index)}
                isWinning={winningSquares.includes(index)}
                index={index}
                rows={rows}
                cols={cols}
                playerInfo={playerInfo}
                isDarkSquare={darkSquare}
                hasSelectionFlow={hasSelectionFlow}
                isSelected={selection === index}
                isLegalTarget={legalTargetIndexes.has(index)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;

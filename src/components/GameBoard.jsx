import React from "react";
import BoardSquare from "./BoardSquare";

/**
 * GameBoard Component - Responsive Grid Container
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only handles grid layout
 * - Open/Closed: Grid size extensible via props (future 4x4, 5x5)
 * 
 * Responsive sizing:
 * - Max width: min(90vw, 420px) for 3x3, scales for larger grids
 * - Gap: Fluid clamp() for consistent spacing across breakpoints
 * - Fits without scrolling on all device sizes
 */

const GameBoard = ({ squares, onSquareClick, winningSquares, gridSize = 3 }) => {
  // Generate grid columns class based on grid size (extensible)
  const gridColsClass = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }[gridSize] || 'grid-cols-3';

  // Max width scales with grid size
  const maxWidthClass = gridSize <= 3 ? 'max-w-grid-3x3' : 'max-w-grid-5x5';

  return (
    <div className="relative" data-tour="board">
      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-[-6%] -z-10 rounded-[36px] bg-gradient-to-br from-indigo-500/20 via-sky-500/8 to-emerald-400/20 opacity-50 blur-3xl dark:from-indigo-500/15 dark:via-slate-900/40 dark:to-emerald-500/20" />
      
      {/* Grid container */}
      <div className={`relative mx-auto w-full ${maxWidthClass} overflow-hidden rounded-panel border border-stone-200/80 bg-stone-50/90 p-card shadow-[0_25px_60px_-30px_rgba(28,25,23,0.35)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70`}>
        <div className={`grid ${gridColsClass} gap-cell`}>
          {squares.map((square, index) => (
            <BoardSquare
              key={index}
              value={square}
              onClick={() => onSquareClick(index)}
              isWinning={winningSquares.includes(index)}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;

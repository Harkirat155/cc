import React from "react";
import BoardSquare from "./BoardSquare";
import { getModeConfig } from "../utils/gameMode";

const GameBoard = ({ 
  squares, 
  onSquareClick, 
  winningSquares = [],
  gameMode = 'classic',
}) => {
  const { size } = getModeConfig(gameMode);
  
  // Dynamic grid columns based on board size
  const gridStyle = {
    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
  };

  // Adjust gap and padding based on board size
  const gapClass = size <= 3 ? 'gap-3' : size === 5 ? 'gap-2' : 'gap-1.5';
  const paddingClass = size <= 3 ? 'p-5' : 'p-3';
  const maxWidthClass = size <= 3 
    ? 'max-w-[min(90vw,420px)]' 
    : size === 5 
    ? 'max-w-[min(95vw,500px)]' 
    : 'max-w-[min(98vw,600px)]';

  return (
    <div className="relative" data-tour="board">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-[-6%] -z-10 rounded-[36px] bg-gradient-to-br from-indigo-500/20 via-sky-500/8 to-emerald-400/20 opacity-50 blur-3xl dark:from-indigo-500/15 dark:via-slate-900/40 dark:to-emerald-500/20" />
      
      {/* Board container */}
      <div className={`relative mx-auto w-full ${maxWidthClass} overflow-hidden rounded-[28px] border border-stone-200/80 bg-stone-50/90 ${paddingClass} shadow-[0_25px_60px_-30px_rgba(28,25,23,0.35)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70`}>
        <div 
          className={`grid ${gapClass}`} 
          style={gridStyle}
        >
          {squares.map((square, index) => (
            <BoardSquare
              key={index}
              value={square}
              onClick={() => onSquareClick(index)}
              isWinning={winningSquares.includes(index)}
              index={index}
              boardSize={size}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;

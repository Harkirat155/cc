import React from "react";
import BoardSquare from "./BoardSquare";

const GameBoard = ({ squares, onSquareClick, winningSquares }) => (
  <div className="relative" data-tour="board">
    <div className="pointer-events-none absolute inset-[-6%] -z-10 rounded-[36px] bg-gradient-to-br from-indigo-500/20 via-sky-500/8 to-emerald-400/20 opacity-50 blur-3xl dark:from-indigo-500/15 dark:via-slate-900/40 dark:to-emerald-500/20" />
    <div className="relative mx-auto w-full max-w-[min(90vw,420px)] overflow-hidden rounded-[28px] border border-stone-200/80 bg-stone-50/90 p-5 shadow-[0_25px_60px_-30px_rgba(28,25,23,0.35)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70">
      <div className="grid grid-cols-3 gap-3">
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

export default GameBoard;

import React, { useCallback, useMemo, useRef, useState } from "react";
import BoardFrame from "./BoardFrame";
import BoardSquare from "./BoardSquare";
import { ConnectPiece, EmptyConnectSlot } from "./games/boardPresentation";
import { cx } from "./games/boardPresentationUtils";
import { getGamePalette } from "./games/palette";
import useReducedMotion from "../hooks/useReducedMotion";

const GRID_COLS = {
  3: "grid-cols-3",
  8: "grid-cols-8",
};

const EMPTY_LEGAL_TARGETS = [];

function resolveGameId(boardSpec, moveStyle) {
  if (moveStyle === "select-target" || boardSpec?.dark) return "checkers";
  if (boardSpec?.rows === 6 && boardSpec?.cols === 7) return "connect4";
  return "ttt";
}

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
  legalTargets = EMPTY_LEGAL_TARGETS,
}) => {
  const colsClass = GRID_COLS[cols] || GRID_COLS[3];
  const isDark = Boolean(boardSpec?.dark);
  const hasSelectionFlow = moveStyle === "select-target";
  const gameId = resolveGameId(boardSpec, moveStyle);
  const palette = getGamePalette(gameId);
  const reducedMotion = useReducedMotion();
  const [activeColumn, setActiveColumn] = useState(null);
  const onSquareClickRef = useRef(onSquareClick);
  onSquareClickRef.current = onSquareClick;

  const handleSquareClick = useCallback((index) => {
    onSquareClickRef.current(index);
  }, []);

  const legalTargetIndexes = useMemo(
    () => new Set((legalTargets || []).map((m) => (typeof m === "object" ? m.to : m))),
    [legalTargets]
  );
  const winningSquareIndexes = useMemo(() => new Set(winningSquares || []), [winningSquares]);
  const isConnectFour = gameId === "connect4";
  const isCheckers = gameId === "checkers";

  if (isConnectFour) {
    return (
      <BoardFrame>
        <div className="flex gap-1 sm:gap-2">
          {Array.from({ length: cols }).map((_, col) => {
            const isHighlighted = activeColumn === col;
            const columnIsFull = Array.from({ length: rows }).every(
              (_, row) => squares[row * cols + col]
            );

            return (
              <button
                key={col}
                type="button"
                onClick={() => handleSquareClick(col)}
                onMouseEnter={() => setActiveColumn(col)}
                onMouseLeave={() => setActiveColumn((current) => (current === col ? null : current))}
                onFocus={() => setActiveColumn(col)}
                onBlur={() => setActiveColumn((current) => (current === col ? null : current))}
                disabled={columnIsFull}
                className={cx(
                  "group flex flex-col gap-1 rounded-2xl p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:p-1.5",
                  isHighlighted ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.04]"
                )}
                aria-label={`Drop piece in column ${col + 1}`}
              >
                {Array.from({ length: rows }).map((__, row) => {
                  const index = row * cols + col;
                  const value = squares[index];
                  const isWinning = winningSquareIndexes.has(index);

                  return value ? (
                    <ConnectPiece
                      key={index}
                      value={value}
                      playerInfo={playerInfo}
                      palette={palette}
                      isWinning={isWinning}
                      reducedMotion={reducedMotion}
                    />
                  ) : (
                    <EmptyConnectSlot key={index} />
                  );
                })}
              </button>
            );
          })}
        </div>
      </BoardFrame>
    );
  }

  if (isCheckers) {
    return (
      <BoardFrame>
        <div className={`grid ${colsClass} overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.02] shadow-2xl`}>
          {squares.map((square, index) => {
            const r = Math.floor(index / cols);
            const c = index % cols;
            const darkSquare = isDark && (r + c) % 2 === 1;

            return (
              <BoardSquare
                key={index}
                value={square}
                onSquareClick={handleSquareClick}
                isWinning={winningSquareIndexes.has(index)}
                index={index}
                rows={rows}
                cols={cols}
                playerInfo={playerInfo}
                gameId={gameId}
                palette={palette}
                isDarkSquare={darkSquare}
                hasSelectionFlow={hasSelectionFlow}
                isSelected={selection === index}
                isLegalTarget={legalTargetIndexes.has(index)}
              />
            );
          })}
        </div>
      </BoardFrame>
    );
  }

  return (
    <BoardFrame>
      <div className={`grid ${colsClass} gap-2 sm:gap-3`}>
        {squares.map((square, index) => {
          const r = Math.floor(index / cols);
          const c = index % cols;
          const darkSquare = isDark && (r + c) % 2 === 1;

          return (
            <BoardSquare
              key={index}
              value={square}
              onSquareClick={handleSquareClick}
              isWinning={winningSquareIndexes.has(index)}
              index={index}
              rows={rows}
              cols={cols}
              playerInfo={playerInfo}
              gameId={gameId}
              palette={palette}
              isDarkSquare={darkSquare}
              hasSelectionFlow={hasSelectionFlow}
              isSelected={selection === index}
              isLegalTarget={legalTargetIndexes.has(index)}
            />
          );
        })}
      </div>
    </BoardFrame>
  );
};

export default GameBoard;

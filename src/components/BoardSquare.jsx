import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import useReducedMotion from "../hooks/useReducedMotion";
import {
  ConnectPiece,
  EmptyConnectSlot,
  LegalTargetDot,
  Piece,
  cx,
  revealProps,
  squareClasses,
} from "./games/boardPresentation";
import ValueMark from "./marks/ValueMark";

function sameSquareValue(a, b) {
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

function areBoardSquarePropsEqual(prev, next) {
  return (
    sameSquareValue(prev.value, next.value) &&
    prev.onSquareClick === next.onSquareClick &&
    prev.isWinning === next.isWinning &&
    prev.index === next.index &&
    prev.rows === next.rows &&
    prev.cols === next.cols &&
    samePlayerInfo(prev.playerInfo, next.playerInfo) &&
    prev.gameId === next.gameId &&
    prev.palette === next.palette &&
    prev.isSelected === next.isSelected &&
    prev.isLegalTarget === next.isLegalTarget &&
    prev.isDarkSquare === next.isDarkSquare &&
    prev.hasSelectionFlow === next.hasSelectionFlow &&
    prev.isColumnHighlighted === next.isColumnHighlighted &&
    prev.onColumnEnter === next.onColumnEnter &&
    prev.onColumnLeave === next.onColumnLeave
  );
}

const BoardSquare = memo(function BoardSquare({
  value,
  onSquareClick,
  isWinning,
  index,
  rows = 3,
  cols = 3,
  playerInfo,
  gameId = "ttt",
  palette,
  isSelected = false,
  isLegalTarget = false,
  isDarkSquare = false,
  hasSelectionFlow = false,
  isColumnHighlighted = false,
  onColumnEnter,
  onColumnLeave,
}) {
  const [isPressed, setIsPressed] = useState(false);
  const pressTimeoutRef = useRef(null);
  const reducedMotion = useReducedMotion();
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

  const handleClick = useCallback(() => {
    // In selection-style games (Checkers), a click is meaningful on a piece
    // we own OR on a legal target — let the parent decide. In placement
    // games, an occupied square is a no-op.
    if (!hasSelectionFlow && hasValue) return;
    setIsPressed(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
    onSquareClick(index);
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
    }
    pressTimeoutRef.current = setTimeout(() => setIsPressed(false), 150);
  }, [hasSelectionFlow, hasValue, index, onSquareClick]);

  useEffect(() => {
    return () => {
      if (pressTimeoutRef.current) {
        clearTimeout(pressTimeoutRef.current);
      }
    };
  }, []);

  const pressed = !reducedMotion && isPressed;
  const buttonClassName = squareClasses({
    gameId,
    isWinning,
    isSelected,
    isLegalTarget,
    isDarkSquare,
    isColumnHighlighted,
    hasSelectionFlow,
    hasValue,
    isPressed: pressed,
  });

  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={handleClick}
      onMouseEnter={onColumnEnter}
      onMouseLeave={onColumnLeave}
      onFocus={onColumnEnter}
      onBlur={onColumnLeave}
      aria-label={tooltipMessage}
      title={tooltipMessage}
      disabled={!hasSelectionFlow && Boolean(hasValue)}
    >
      {isLegalTarget && !hasValue && (
        <LegalTargetDot />
      )}
      {gameId === "connect4" ? (
        hasValue ? (
          <ConnectPiece
            value={value}
            playerInfo={playerInfo}
            palette={palette}
            isWinning={isWinning}
            reducedMotion={reducedMotion}
          />
        ) : (
          <EmptyConnectSlot />
        )
      ) : isPiece ? (
        <Piece
          piece={value}
          playerInfo={playerInfo}
          palette={palette}
          reducedMotion={reducedMotion}
        />
      ) : (
        hasValue && (
          <motion.span
            {...revealProps(reducedMotion, isWinning ? 1.08 : 1)}
            className="relative z-10 inline-flex leading-none"
          >
            <ValueMark value={value} playerInfo={playerInfo} palette={palette} />
          </motion.span>
        )
      )}
      {pressed && (
        <span
          className={cx(
            "pointer-events-none absolute inset-0 bg-foreground/10",
            gameId === "checkers" ? "rounded-none" : "rounded-2xl"
          )}
        />
      )}
    </button>
  );
}, areBoardSquarePropsEqual);

export default BoardSquare;

import { useState, useRef, useCallback, useEffect } from "react";
import {
  appendHistorySnapshot,
  createSystemEntry,
  detectChangedIndex,
} from "../utils/history";
import { shouldArchiveCompletedGame } from "../utils/completedGames";
import { emptyBoard } from "../utils/board";

/**
 * Hook for managing game move history and completed game archives.
 * Handles move-by-move history, time-travel viewing, and game archiving.
 *
 * @returns {object} History state and actions
 */
export default function useGameHistory() {
  // Move-by-move history for the CURRENT (ongoing) game
  const [moveHistory, setMoveHistory] = useState(() => [
    createSystemEntry({
      board: emptyBoard(),
      message: "Game start • X to move",
      moveNumber: 0,
    }),
  ]);

  // Concise summaries of COMPLETED games
  const [completedGames, setCompletedGames] = useState([]);

  // Sequence of moves for current game (compact form)
  const moveSequenceRef = useRef([]);
  const lastArchivedSignatureRef = useRef(null);
  const lastBoardRef = useRef(emptyBoard());

  // Time-travel index (which snapshot user is viewing)
  const [viewIndex, setViewIndex] = useState(0);
  const viewIndexRef = useRef(0);

  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);

  /**
   * Record a move in history
   */
  const recordMove = useCallback((board, resultText, entryType, timestamp = Date.now()) => {
    const boardSnapshot = Array.isArray(board) ? board.slice() : emptyBoard();
    const changedIndex = detectChangedIndex(lastBoardRef.current, boardSnapshot);
    const mark = changedIndex !== null && changedIndex >= 0 ? boardSnapshot[changedIndex] : null;

    setMoveHistory((historyList) => {
      const moveNumber =
        mark && changedIndex !== null
          ? moveSequenceRef.current.length + 1
          : historyList.length;

      const { history: nextHistory, appended } = appendHistorySnapshot(historyList, {
        board: boardSnapshot,
        result: resultText,
        type: entryType,
        moveNumber,
        mark,
        index: changedIndex,
        timestamp,
      });

      if (appended && mark && changedIndex !== null) {
        moveSequenceRef.current.push({ mark, index: changedIndex, timestamp });
      }

      // Auto-advance view if user was at the latest move
      if (appended && viewIndexRef.current === historyList.length - 1) {
        setViewIndex(nextHistory.length - 1);
      }

      lastBoardRef.current = boardSnapshot.slice();
      return nextHistory;
    });

    return { changedIndex, mark };
  }, []);

  /**
   * Archive the current game if finished
   */
  const finalizeCurrentGame = useCallback((winner) => {
    if (!winner) return;

    const sequenceStrings = moveSequenceRef.current.map(
      (m) => `${m.mark ?? ""}${m.index ?? ""}`
    );
    const lastMoveTimestamp =
      moveSequenceRef.current.length > 0
        ? moveSequenceRef.current[moveSequenceRef.current.length - 1].timestamp
        : null;

    const { shouldArchive, signature } = shouldArchiveCompletedGame({
      lastSignature: lastArchivedSignatureRef.current,
      sequenceStrings,
      lastMoveTimestamp,
    });

    if (!shouldArchive) {
      lastArchivedSignatureRef.current = signature;
      return;
    }

    const summary = {
      id: Date.now(),
      winner: winner === "draw" ? null : winner,
      draw: winner === "draw",
      sequence: sequenceStrings,
      totalMoves: sequenceStrings.length,
      finishedAt: new Date().toISOString(),
    };

    setCompletedGames((g) => [...g, summary]);
    lastArchivedSignatureRef.current = signature;
  }, []);

  /**
   * Reset history for a new game
   */
  const resetHistory = useCallback((message = "New game • X to move", tag = "reset") => {
    const freshBoard = emptyBoard();
    moveSequenceRef.current = [];
    lastBoardRef.current = freshBoard;
    setMoveHistory([
      createSystemEntry({
        board: freshBoard,
        message,
        moveNumber: 0,
        tag,
      }),
    ]);
    setViewIndex(0);
  }, []);

  /**
   * Jump to a specific move in history (time-travel)
   */
  const jumpTo = useCallback(
    (idx) => {
      if (idx < 0 || idx >= moveHistory.length) return;
      setViewIndex(idx);
    },
    [moveHistory.length]
  );

  /**
   * Resume to the latest move
   */
  const resumeLatest = useCallback(() => {
    setViewIndex(moveHistory.length - 1);
  }, [moveHistory.length]);

  /**
   * Get the displayed board based on current view index
   */
  const getDisplayedBoard = useCallback(() => {
    return moveHistory[Math.min(viewIndex, moveHistory.length - 1)].squares;
  }, [moveHistory, viewIndex]);

  /**
   * Get last board ref for change detection
   */
  const getLastBoard = useCallback(() => lastBoardRef.current, []);

  /**
   * Update last board ref
   */
  const setLastBoard = useCallback((board) => {
    lastBoardRef.current = board.slice();
  }, []);

  /**
   * Get current move sequence
   */
  const getMoveSequence = useCallback(() => moveSequenceRef.current, []);

  return {
    // State
    moveHistory,
    completedGames,
    viewIndex,
    displayedBoard: getDisplayedBoard(),

    // Actions
    recordMove,
    finalizeCurrentGame,
    resetHistory,
    jumpTo,
    resumeLatest,

    // Utilities
    getLastBoard,
    setLastBoard,
    getMoveSequence,
  };
}

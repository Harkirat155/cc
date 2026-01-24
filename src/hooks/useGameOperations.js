/**
 * Game Operations Hook
 * Single Responsibility: Handle game-specific operations (moves, resets, requests)
 */

import { useCallback } from "react";

// Game logic helpers
const emptyBoard = () => Array(9).fill("");
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function calcWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[a] && board[a] === board[c])
      return { winner: board[a], line: [a, b, c] };
  }
  if (board.every((c) => c !== "")) return { winner: "draw", line: [] };
  return null;
}

/**
 * Hook for game operations
 * @param {Object} deps - Dependencies
 * @returns {Object} Game operation functions
 */
export function useGameOperations(deps) {
  const {
    gameState,
    setGameState,
    initialLocalState,
    socketRef,
    roomId,
    isMultiplayer,
    player,
    recordMove,
    resumeLatest,
    finalizeCurrentGame,
    resetHistory,
    setShowModal,
    setNewGameRequester,
  } = deps;

  /**
   * Handle square click (Single Responsibility: process game moves)
   */
  const handleSquareClick = useCallback(
    (index) => {
      // Auto-resume to latest if viewing past
      resumeLatest();

      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current || !socketRef.current.connected) return;
        const socket = socketRef.current;
        if (gameState.winner) return;
        if (gameState.turn !== player) return;
        if (gameState.board[index] !== "") return;
        socket.emit("makeMove", { roomId, index });
        return;
      }

      // Local game path
      setGameState((current) => {
        if (current.winner || current.board[index] !== "") return current;
        const newBoard = [...current.board];
        newBoard[index] = current.turn;
        const result = calcWinner(newBoard);
        const newTurn = current.turn === "X" ? "O" : "X";

        const newState = {
          ...current,
          board: newBoard,
          turn: result ? current.turn : newTurn,
          winner: result?.winner || null,
          winningLine: result?.line || [],
          xScore: result?.winner === "X" ? current.xScore + 1 : current.xScore,
          oScore: result?.winner === "O" ? current.oScore + 1 : current.oScore,
        };

        const resultText = result
          ? result.winner === "draw"
            ? "Draw"
            : `${result.winner} wins`
          : `${newTurn}'s turn`;
        const entryType = result ? (result.winner === "draw" ? "draw" : "win") : "move";
        recordMove(newBoard.slice(), resultText, entryType);

        if (result) setShowModal(true);
        return newState;
      });
    },
    [isMultiplayer, player, roomId, gameState, recordMove, resumeLatest, socketRef, setGameState, setShowModal]
  );

  /**
   * Reset game (Single Responsibility: handle game reset)
   */
  const resetGame = useCallback(() => {
    finalizeCurrentGame(gameState.winner);

    if (isMultiplayer && socketRef.current?.connected) {
      socketRef.current.emit("resetGame", { roomId });
    } else {
      setGameState((prev) => ({
        ...initialLocalState,
        xScore: prev.xScore,
        oScore: prev.oScore,
      }));
    }

    resetHistory("New game • X to move", "reset");
    setShowModal(false);
    setNewGameRequester(null);
  }, [finalizeCurrentGame, gameState.winner, isMultiplayer, roomId, socketRef, setGameState, initialLocalState, resetHistory, setShowModal, setNewGameRequester]);

  /**
   * Reset scores (Single Responsibility: handle score reset)
   */
  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current?.connected) {
      // In multiplayer, only emit to server - don't reset local state
      // Server will broadcast gameUpdate with zeroed scores
      socketRef.current.emit("resetScores", { roomId });
    } else {
      // Local game: reset everything
      setGameState(() => ({ ...initialLocalState }));
      resetHistory("Scores reset • X to move", "system");
    }
    setShowModal(false);
    setNewGameRequester(null);
  }, [isMultiplayer, roomId, socketRef, setGameState, initialLocalState, resetHistory, setShowModal, setNewGameRequester]);

  /**
   * Request new game (Single Responsibility: handle new game request)
   */
  const requestNewGame = useCallback(() => {
    if (!isMultiplayer || !socketRef.current?.connected) return;
    setNewGameRequester(socketRef.current.id);
    socketRef.current.emit("requestNewGame", { roomId });
  }, [isMultiplayer, socketRef, roomId, setNewGameRequester]);

  /**
   * Cancel new game request (Single Responsibility: handle request cancellation)
   */
  const cancelNewGameRequest = useCallback(() => {
    if (!isMultiplayer || !socketRef.current?.connected) return;
    socketRef.current.emit("cancelNewGameRequest", { roomId });
    setNewGameRequester(null);
  }, [isMultiplayer, socketRef, roomId, setNewGameRequester]);

  return {
    handleSquareClick,
    resetGame,
    resetScores,
    requestNewGame,
    cancelNewGameRequest,
  };
}

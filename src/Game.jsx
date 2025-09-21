import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GameBoard from "./components/GameBoard";
import HistoryPanel from "./components/HistoryPanel";
import MenuPanel from "./components/MenuPanel";
import ResultModal from "./components/ResultModal";
import ValueMark from "./components/marks/ValueMark";
import useSocketGame from "./hooks/useSocketGame";
import Navbar from "./components/Navbar";
import PeoplePanel from "./components/PeoplePanel";

const Game = () => {
  const navigate = useNavigate();
  const { roomId: paramRoomId } = useParams();
  const {
    gameState,
    history,
    completedGames,
    viewIndex,
    displayedBoard,
    jumpTo,
    resumeLatest,
    message,
    roomId,
    player,
    isMultiplayer,
    showModal,
    newGameRequester,
    requestNewGame,
  cancelNewGameRequest,
    createRoom,
    joinRoom,
    handleSquareClick,
    resetGame,
    resetScores,
    leaveRoom,
    socketId,
    roster,
    newGameRequestedAt,
  } = useSocketGame();
  const winningSquares = gameState.winningLine || [];
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);

  // Ensure only one side panel is open at a time
  const handleTogglePeople = () => {
    setIsPeopleOpen((prev) => {
      const next = !prev;
      if (next) setIsHistoryOpen(false);
      return next;
    });
  };

  const handleToggleHistory = () => {
    setIsHistoryOpen((prev) => {
      const next = !prev;
      if (next) setIsPeopleOpen(false);
      return next;
    });
  };

  // winningSquares derived from multiplayer/local hook state

  // Auto-join a room when visiting /room/:roomId via a shared link
  useEffect(() => {
    const code = (paramRoomId || "").trim().toUpperCase();
    if (!code) return;
    // Only attempt auto-join if not already in a room
    if (!isMultiplayer) {
      joinRoom(code);
    }
    // If already in a different room, do nothing for now to avoid multi-room state
  }, [paramRoomId, isMultiplayer, joinRoom]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 pb-28 sm:pb-32">
      {/* Navbar with brand + actions */}
      <Navbar
        onToggleHistory={handleToggleHistory}
        isHistoryOpen={isHistoryOpen}
        onTogglePeople={handleTogglePeople}
        isPeopleOpen={isPeopleOpen}
      />
      {/* push content below navbar height */}
      <div className="h-20" />
      <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">{message}</div>
      <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">
        Mode: {isMultiplayer ? "Multiplayer" : "Local"}{" "}
        {roomId && `| Room: ${roomId}`} {player && `| You: ${player}`}
      </div>
      <div className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
        Score: <ValueMark value="X" /> - {gameState.xScore} |{" "}
        <ValueMark value="O" /> - {gameState.oScore}
      </div>
      <div className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
        Turn: {gameState.turn ? <ValueMark value={gameState.turn} /> : "-"}
      </div>
      <GameBoard
        squares={displayedBoard}
        onSquareClick={handleSquareClick}
        winningSquares={winningSquares}
      />
      {/* Slide-over panels */}
      {/* People Panel (right slide-over) */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 w-80 max-w-[85vw] transform bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl transition-transform duration-300 ${
          isPeopleOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <PeoplePanel
          roster={roster}
          socketId={socketId}
          isMultiplayer={isMultiplayer}
          roomId={roomId}
        />
      </div>
      {/* History Panel (right slide-over) */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 w-80 max-w-[85vw] transform bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl transition-transform duration-300 ${
          isHistoryOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <HistoryPanel
          history={history}
          completedGames={completedGames}
          viewIndex={viewIndex}
          jumpTo={jumpTo}
          resumeLatest={resumeLatest}
        />
      </div>
      <MenuPanel
        onReset={resetScores}
        onNewGame={resetGame}
        hasMoves={history.length > 1}
        canResetScore={gameState.xScore !== 0 || gameState.oScore !== 0}
        createRoom={createRoom}
        leaveRoom={() => {
          leaveRoom();
          navigate("/");
        }}
        isMultiplayer={isMultiplayer}
        roomId={roomId}
      />
      {showModal && (
        <ResultModal
          result={
            gameState.winner === "draw"
              ? "Draw!"
              : gameState.winner
              ? `${gameState.winner} Wins!`
              : "Game Over"
          }
          onStartNewLocal={resetGame}
          onJoinNewGame={resetGame}
          onLeaveRoom={() => {
            leaveRoom();
            navigate("/");
          }}
          isMultiplayer={isMultiplayer}
          player={player}
          newGameRequester={newGameRequester}
          requestNewGame={requestNewGame}
          cancelNewGameRequest={() => {
            cancelNewGameRequest();
          }}
          socketId={socketId}
          newGameRequestedAt={newGameRequestedAt}
          rematchTimeoutSec={20}
        />
      )}
    </div>
  );
};

export default Game;

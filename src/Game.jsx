import React from "react";
import GameBoard from "./components/GameBoard";
import HistoryPanel from "./components/HistoryPanel";
import MenuPanel from "./components/MenuPanel";
import ResultModal from "./components/ResultModal";
import ValueMark from "./components/marks/ValueMark";
import useSocketGame from "./hooks/useSocketGame";
import RoomControls from "./components/RoomControls";

const Game = () => {
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
    isRoomCreator,
    showModal,
    newGameRequester,
    requestNewGame,
    createRoom,
    joinRoom,
    handleSquareClick,
    resetGame,
    resetScores,
    leaveRoom,
    socketId,
  } = useSocketGame();
  const winningSquares = gameState.winningLine || [];

  // winningSquares derived from multiplayer/local hook state

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-gray-800 animate-pulse">
        Tic Tac Toe
      </h1>
      <div className="mb-2 text-sm text-gray-600">{message}</div>
      <div className="mb-2 text-sm text-gray-600">
        Mode: {isMultiplayer ? "Multiplayer" : "Local"}{" "}
        {roomId && `| Room: ${roomId}`} {player && `| You: ${player}`}
      </div>
      <div className="mb-4 text-lg font-medium text-gray-700">
        Score: <ValueMark value="X" /> - {gameState.xScore} |{" "}
        <ValueMark value="O" /> - {gameState.oScore}
      </div>
      <div className="mb-4 text-lg font-medium text-gray-700">
        Turn: {gameState.turn ? <ValueMark value={gameState.turn} /> : "-"}
      </div>
      <GameBoard
        squares={displayedBoard}
        onSquareClick={handleSquareClick}
        winningSquares={winningSquares}
      />
      <HistoryPanel
        history={history}
        completedGames={completedGames}
        viewIndex={viewIndex}
        jumpTo={jumpTo}
        resumeLatest={resumeLatest}
      />
      <RoomControls
        createRoom={createRoom}
        joinRoom={joinRoom}
        leaveRoom={leaveRoom}
        isMultiplayer={isMultiplayer}
        roomId={roomId}
        isRoomCreator={isRoomCreator}
      />
      <MenuPanel onReset={resetScores} onNewGame={resetGame} />
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
          onLeaveRoom={leaveRoom}
          isMultiplayer={isMultiplayer}
          player={player}
          newGameRequester={newGameRequester}
          requestNewGame={requestNewGame}
          socketId={socketId}
        />
      )}
    </div>
  );
};

export default Game;

import React from "react";

const ResultModal = ({
  result,
  onStartNewLocal, // original resetGame for initiator or local
  // onJoinNewGame, // opponent joins after initiator resets (handled by onStartNewLocal)
  onLeaveRoom,
  isMultiplayer,
  // player,
  newGameRequester,
  requestNewGame,
  socketId,
}) => {
  const isRequester =
    isMultiplayer &&
    newGameRequester &&
    socketId &&
    newGameRequester === socketId;
  const someoneRequested = isMultiplayer && !!newGameRequester;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center animate-fadeIn">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100 flex flex-col items-center justify-center space-y-3">
        <h2 className="text-2xl font-bold text-gray-800 text-center">
          {result}
        </h2>
        {!isMultiplayer && (
          <button
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            onClick={onStartNewLocal}
          >
            Start New Game
          </button>
        )}
        {isMultiplayer && !someoneRequested && (
          <button
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            onClick={requestNewGame}
          >
            Request New Game
          </button>
        )}
        {isMultiplayer && someoneRequested && !isRequester && (
          <>
            <button
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              onClick={onStartNewLocal}
            >
              Join New Game
            </button>
            <button
              className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              onClick={onLeaveRoom}
            >
              Leave Room
            </button>
          </>
        )}
        {isMultiplayer && someoneRequested && isRequester && (
          <div className="text-sm text-gray-600">Waiting for opponent...</div>
        )}
      </div>
    </div>
  );
};

export default ResultModal;

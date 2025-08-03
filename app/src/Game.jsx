import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Board from './components/Board'; // Adjust path as needed
import HistoryPanel from './components/HistoryPanel'; // Adjust path as needed
import Menu from './components/Menu'; // Adjust path as needed
import ResultModal from './components/ResultModal'; // Adjust path as needed
import './App.css'; // Adjust path as needed

const socket = io('https://crisscross-backend.onrender.com', { // Replace with your backend URL
  reconnection: true,
  reconnectionAttempts: 5,
});

function App() {
  const [gameState, setGameState] = useState({
    board: Array(9).fill(''),
    turn: 'X',
    winner: null,
    xScore: 0,
    oScore: 0,
  });
  const [roomId, setRoomId] = useState('');
  const [player, setPlayer] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState('Create or join a game room');
  const [history, setHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    socket.on('gameUpdate', (state) => {
      setGameState(state);
      setHistory((prev) => [...prev, state.board]);
      if (state.winner) {
        setShowModal(true);
      }
    });

    socket.on('startGame', () => {
      setGameStarted(true);
      setMessage(`You are ${player}. Game started!`);
    });

    socket.on('playerDisconnected', ({ message }) => {
      setMessage(message);
      setGameStarted(false);
      setShowModal(true);
    });

    return () => {
      socket.off('gameUpdate');
      socket.off('startGame');
      socket.off('playerDisconnected');
    };
  }, [player]);

  const createRoom = () => {
    socket.emit('createRoom', ({ roomId, player }) => {
      setRoomId(roomId);
      setPlayer(player);
      setMessage(`Room created: ${roomId}. Share this link: https://harkirat155.github.io/crissCross/?room=${roomId}`);
    });
  };

  const joinRoom = (inputRoomId) => {
    socket.emit('joinRoom', { roomId: inputRoomId }, ({ error, player }) => {
      if (error) {
        setMessage(error);
      } else {
        setRoomId(inputRoomId);
        setPlayer(player);
        setMessage(`Joined room ${inputRoomId} as ${player}`);
      }
    });
  };

  const handleSquareClick = (index) => {
    if (!gameStarted || gameState.winner || gameState.board[index] !== '' || gameState.turn !== player) {
      return;
    }
    socket.emit('makeMove', { roomId, index });
  };

  const resetGame = () => {
    socket.emit('resetGame', { roomId });
    setShowModal(false);
  };

  const resetScores = () => {
    socket.emit('resetScores', { roomId });
  };

  const handleJoinInput = (e) => {
    e.preventDefault();
    const inputRoomId = e.target.elements.roomId.value;
    joinRoom(inputRoomId);
  };

  // Extract roomId from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      joinRoom(roomFromUrl);
    }
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100">
      {!gameStarted ? (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Tic Tac Toe</h1>
          <button
            onClick={createRoom}
            className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
          >
            Create New Game
          </button>
          <form onSubmit={handleJoinInput} className="flex flex-col">
            <input
              type="text"
              name="roomId"
              placeholder="Enter Room ID"
              className="border p-2 mb-2 rounded"
            />
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
              Join Game
            </button>
          </form>
          <p className="mt-4">{message}</p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-4">Tic Tac Toe</h1>
          <p className="mb-2">Room: {roomId} | You are: {player}</p>
          <p className="mb-2">Turn: {gameState.turn}</p>
          <div className="flex">
            <HistoryPanel history={history} />
            <Board
              squares={gameState.board}
              onSquareClick={handleSquareClick}
            />
          </div>
          <Menu onNewGame={resetGame} onResetScore={resetScores} />
          <ResultModal
            show={showModal}
            winner={gameState.winner}
            onClose={() => setShowModal(false)}
            onNewGame={resetGame}
          />
          <div className="mt-4">
            <p>Score: X: {gameState.xScore} | O: {gameState.oScore}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
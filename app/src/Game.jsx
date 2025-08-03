import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import HistoryPanel from './components/HistoryPanel';
import MenuPanel from './components/MenuPanel';
import ResultModal from './components/ResultModal';
import ValueMark from './components/ValueMark';

const Game = () => {
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [history, setHistory] = useState([]);
  const [xWins, setXWins] = useState(0);
  const [oWins, setOWins] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState('');

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line };
      }
    }
    return squares.every(s => s) ? { winner: 'Draw', line: [] } : null;
  };

  const handleSquareClick = (index) => {
    if (squares[index] || calculateWinner(squares)) return;
    const newSquares = squares.slice();
    newSquares[index] = isXNext ? 'X' : 'O';
    setSquares(newSquares);
    setIsXNext(!isXNext);

    const winnerInfo = calculateWinner(newSquares);
    if (winnerInfo) {
      const resultText = winnerInfo.winner === 'Draw' ? 'Draw!' : `${winnerInfo.winner} Wins!`;
      setResult(resultText);
      setShowModal(true);
      setHistory([...history, {
        squares: newSquares,
        result: resultText
      }]);
      if (winnerInfo.winner === 'X') setXWins(xWins + 1);
      if (winnerInfo.winner === 'O') setOWins(oWins + 1);
    }
  };

  const handleNewGame = () => {
    setSquares(Array(9).fill(null));
    // setIsXNext(true);
    setShowModal(false);
  };

  const handleReset = () => {
    setSquares(Array(9).fill(null));
    setIsXNext(true);
    setHistory([]);
    setXWins(0);
    setOWins(0);
    setShowModal(false);
  };

  const handleHistoryClick = (index) => {
    const selectedGame = history[index];
    setSquares(selectedGame.squares);
    setIsXNext(true);
    setShowModal(false);
  };

  const winnerInfo = calculateWinner(squares);
  const winningSquares = winnerInfo ? winnerInfo.line : [];

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-gray-800 animate-pulse">Tic Tac Toe</h1>
      <div className="mb-4 text-lg font-medium text-gray-700">
        Score: <ValueMark value="X" /> - {xWins} | <ValueMark value="O" /> - {oWins}
      </div>
      <div className="mb-4 text-lg font-medium text-gray-700">
        Turn: {isXNext ? <ValueMark value="X" /> : <ValueMark value="O" />}
      </div>
      <GameBoard squares={squares} onSquareClick={handleSquareClick} winningSquares={winningSquares} />
      <HistoryPanel history={history} onHistoryClick={handleHistoryClick} />
      <MenuPanel onReset={handleReset} onNewGame={handleNewGame} />
      {showModal && <ResultModal result={result} onClose={handleNewGame} />}
    </div>
  );
};

export default Game;
import React from 'react';
import BoardSquare from './BoardSquare';

const GameBoard = ({ squares, onSquareClick, winningSquares }) => (
  <div className="grid grid-cols-3 gap-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transform transition-all duration-500 border border-gray-200 dark:border-gray-700">
    {squares.map((square, index) => (
      <BoardSquare
        key={index}
        value={square}
        onClick={() => onSquareClick(index)}
        isWinning={winningSquares.includes(index)}
      />
    ))}
  </div>
);

export default GameBoard;

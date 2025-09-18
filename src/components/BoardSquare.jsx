import React from 'react';
import ValueMark from './marks/ValueMark';

const BoardSquare = ({ value, onClick, isWinning }) => (
  <button
    className={`aspect-square text-4xl font-bold border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all duration-300
        ${isWinning ? 'bg-green-200 dark:bg-green-700/40 scale-110' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
        ${value === 'X' ? 'text-blue-600' : value === 'O' ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'}`}
      style={{ width: 'clamp(56px, 22vw, 96px)', cursor: 'pointer' }}
      onClick={onClick}
      aria-label={value ? `Square marked with ${value}` : 'Empty square'}
  >
    {value ? <ValueMark value={value} /> : null}
  </button>
);

export default BoardSquare;

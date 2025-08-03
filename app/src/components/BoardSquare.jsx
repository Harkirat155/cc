import React from 'react';
import ValueMark from './ValueMark';

const BoardSquare = ({ value, onClick, isWinning }) => (
  <button
    // className={`w-24 h-24 text-4xl font-bold border-2 border-gray-300 flex items-center justify-center transition-all duration-300 
    //   ${isWinning ? 'bg-green-200 scale-110' : 'hover:bg-gray-200'}`}
    // onClick={onClick}
    className={`aspect-square text-4xl font-bold border-2 border-gray-300 flex items-center justify-center transition-all duration-300
        ${isWinning ? 'bg-green-200 scale-110' : 'hover:bg-gray-200'}
        ${value === 'X' ? 'text-blue-600' : value === 'O' ? 'text-red-600' : ''}`}
      style={{ width: 'clamp(56px, 22vw, 96px)' }}
      onClick={onClick}
  >
    {value ? <ValueMark value={value} /> : null}
  </button>
);

export default BoardSquare;

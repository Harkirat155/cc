import React from 'react';
import ValueMark from './marks/ValueMark';
import { Tooltip } from './ui/Tooltip';

const BoardSquare = ({ value, onClick, isWinning, index }) => {
  const row = typeof index === 'number' ? Math.floor(index / 3) + 1 : null;
  const col = typeof index === 'number' ? (index % 3) + 1 : null;
  const positionText = row && col ? `row ${row}, column ${col}` : 'this square';
  let tooltipMessage;

  if (value) {
    tooltipMessage = `Square ${positionText} • Mark ${value}${isWinning ? ' (winning line)' : ''}`;
  } else {
    tooltipMessage = `Square ${positionText} • Click to place your mark`;
  }

  return (
    <Tooltip content={tooltipMessage}>
      <button
        className={`aspect-square text-4xl font-bold border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all duration-300
        ${isWinning ? 'bg-green-200 dark:bg-green-700/40 scale-110' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
        ${value ? '' : 'text-gray-800 dark:text-gray-100'}`}
        style={{ width: 'clamp(56px, 22vw, 96px)', cursor: 'pointer' }}
        onClick={onClick}
        aria-label={tooltipMessage}
      >
        {value ? <ValueMark value={value} /> : null}
      </button>
    </Tooltip>
  );
};

export default BoardSquare;

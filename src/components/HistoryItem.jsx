import React from 'react';

const HistoryItem = ({ game, index, onClick, active }) => (
  <li
    className={`py-1.5 px-3 rounded-md transition-colors duration-150 cursor-pointer text-xs flex justify-between items-center font-medium tracking-wide ${active ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'hover:bg-gray-100 text-gray-700'}`}
    onClick={() => onClick(index)}
  >
    <span className="truncate max-w-[120px]" title={game.result}>{index + 1}. {game.result}</span>
    {active && <span className="text-[10px] font-semibold">●</span>}
  </li>
);

export default HistoryItem;

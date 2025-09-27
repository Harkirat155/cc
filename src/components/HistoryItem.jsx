import React from 'react';
import { Tooltip } from './ui/Tooltip';

const HistoryItem = ({ game, index, onClick, active }) => {
  const description = game?.result || `Move ${index + 1}`;
  const tooltipContent = `Go to move ${index + 1} • ${description}`;

  return (
    <Tooltip content={tooltipContent} side="left">
      <li
        className={`py-1.5 px-3 rounded-md transition-colors duration-150 cursor-pointer text-xs flex justify-between items-center font-medium tracking-wide ${active ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
        onClick={() => onClick(index)}
        aria-label={tooltipContent}
      >
        <span className="truncate max-w-[120px]">{index + 1}. {description}</span>
        {active && <span className="text-[10px] font-semibold">●</span>}
      </li>
    </Tooltip>
  );
};

export default HistoryItem;

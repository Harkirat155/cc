import React from 'react';

const HistoryItem = ({ game, index, onClick }) => (
  <li className="py-2 px-4 hover:bg-gray-100 rounded-lg transition-all duration-200 cursor-pointer" onClick={() => onClick(index)}>
    <span className="text-sm font-medium text-gray-700">
      Game {index + 1}: {game.result}
    </span>
  </li>
);

export default HistoryItem;

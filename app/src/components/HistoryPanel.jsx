
import React, { useRef, useState, useEffect } from 'react';
import HistoryItem from './HistoryItem';

const HistoryPanel = ({ history, onHistoryClick }) => {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  // Collapse panel when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  // Show only latest game when collapsed
  const latestGame = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div
      ref={panelRef}
      className={`absolute top-4 left-4 bg-white rounded-lg shadow-lg transition-all duration-300 ${expanded ? 'p-4 w-64 max-h-96 overflow-y-auto' : 'p-2 w-56 cursor-pointer'}`}
      onClick={() => !expanded && history.length > 0 ? setExpanded(true) : undefined}
      style={{ zIndex: 20 }}
    >
      {expanded ? (
        <>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Game History</h3>
          <ul>
            {history.map((game, index) => (
              <HistoryItem key={index} game={game} index={index} onClick={onHistoryClick} />
            ))}
          </ul>
        </>
      ) : (
        latestGame ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Latest: {latestGame.result}</span>
            <span className="ml-2 text-xs text-blue-500">▼</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">No games yet</span>
        )
      )}
    </div>
  );
};

export default HistoryPanel;

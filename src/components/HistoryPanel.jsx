import { useRef, useState, useEffect } from "react";
import HistoryItem from "./HistoryItem";

const HistoryPanel = ({ history, completedGames = [], viewIndex, jumpTo, resumeLatest }) => {
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expanded]);

  // Show only latest game when collapsed
  const latestGame = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div
      ref={panelRef}
      className={`absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 transition-all duration-300 ${
        expanded
          ? "p-4 w-72 max-h-[420px] overflow-hidden flex flex-col"
          : "p-2 w-56 cursor-pointer"
      }`}
      onClick={() =>
        !expanded && (history.length > 0 || completedGames.length > 0)
          ? setExpanded(true)
          : undefined
      }
      style={{ zIndex: 20 }}
    >
      {expanded ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold tracking-wide text-gray-800">
              History
            </h3>
            <button
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-300 hover:border-gray-400"
              onClick={() => setExpanded(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="text-[11px] uppercase text-gray-500 mb-1">
            Current Game
          </div>
          <ul
            className="mb-2 pr-1 space-y-1 overflow-y-auto flex-1 min-h-16"
            style={{ scrollbarWidth: "thin" }}
          >
            {history.map((game, index) => (
              <HistoryItem
                key={index}
                game={game}
                index={index}
                active={index === viewIndex}
                onClick={() => jumpTo(index)}
              />
            ))}
            {history.length === 0 && (
              <li className="text-xs text-gray-400">No moves yet</li>
            )}
          </ul>
          {history.length > 1 && viewIndex < history.length - 1 && (
            <button
              type="button"
              onClick={resumeLatest}
              className="mb-3 text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
            >
              Resume Live
            </button>
          )}
          <div className="text-[11px] uppercase text-gray-500 mb-1 mt-1 flex items-center justify-between">
            <span>Completed</span>
            {completedGames.length > 0 && (
              <span className="text-[10px] font-medium text-gray-400">
                {completedGames.length}
              </span>
            )}
          </div>
          <ul
            className="pr-1 space-y-1 max-h-32 overflow-y-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            {completedGames.length > 0 ? (
              completedGames
                .slice()
                .reverse()
                .map((g) => (
                  <li
                    key={g.id}
                    className="text-[11px] px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 flex justify-between gap-2 font-mono"
                  >
                    <span
                      className="truncate w-40"
                      title={g.sequence.join(",")}
                    >
                      {g.sequence.join(",")}
                    </span>
                    <span
                      className={`shrink-0 ${
                        g.draw ? "text-amber-600" : "text-green-600"
                      } font-semibold`}
                    >
                      {g.draw ? "Draw" : g.winner + " Won!"}
                    </span>
                  </li>
                ))
            ) : (
              <li className="text-xs text-gray-400">None yet</li>
            )}
          </ul>
        </>
      ) : latestGame || completedGames.length ? (
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-gray-700">
            {latestGame ? `Latest: ${latestGame.result}` : "Completed games"}
          </span>
          <span className="ml-2 text-[10px] text-blue-500">▼</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400">No games yet</span>
      )}
    </div>
  );
};

export default HistoryPanel;

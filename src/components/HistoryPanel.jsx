import { useMemo } from "react";
import HistoryItem from "./HistoryItem";
import { Tooltip } from "./ui/Tooltip";
import ValueMark from "./marks/ValueMark";
import { Crown, RefreshCcw, Users } from "lucide-react";
import { indexToCoordinate } from "../utils/history";

const formatSequence = (sequence = []) =>
  sequence.map((step) => {
    if (typeof step !== "string" || step.length < 2) return step;
    const mark = step[0];
    const idx = Number(step.slice(1));
    const coord = indexToCoordinate(Number.isNaN(idx) ? null : idx);
    return `${mark}@${coord?.label ?? idx}`;
  });

const HistoryPanel = ({
  history = [],
  completedGames = [],
  viewIndex = 0,
  jumpTo,
  resumeLatest,
  onClose,
  roster = {},
  socketId,
  isMultiplayer,
  youAre,
  currentTurn,
  winner,
}) => {
  const hasHistory = history.length > 0;
  const totalMoves = Math.max(0, history.length - 1);
  const safeIndex = hasHistory
    ? Math.min(Math.max(viewIndex, 0), history.length - 1)
    : 0;
  const activeEntry = hasHistory ? history[safeIndex] ?? null : null;
  const isLiveView = hasHistory ? safeIndex === history.length - 1 : true;

  const statusLine = useMemo(() => {
    if (winner) {
      return winner === "draw"
        ? "Game finished in a draw"
        : `${winner} wins the round`;
    }
    if (isLiveView) {
      return currentTurn
        ? `Live • ${currentTurn} to move`
        : "Live timeline";
    }
    if (activeEntry?.mark && activeEntry?.coordinate) {
      return `Replaying ${activeEntry.mark} at ${activeEntry.coordinate}`;
    }
    return "Replaying earlier move";
  }, [winner, isLiveView, currentTurn, activeEntry]);

  const resolveActor = (entry) => {
    if (!entry?.mark) {
      return {
        label: entry?.type === "reset" ? "Round reset" : "System event",
        detail: entry?.result ?? "",
        isYou: false,
      };
    }
    const id = entry.mark === "X" ? roster?.X : roster?.O;
    const shortId = id ? `${id.slice(0, 4)}…${id.slice(-2)}` : null;
    const isYouSeat = youAre && youAre === entry.mark;
    const isYouSocket = socketId && id && socketId === id;
    const isYou = Boolean(isYouSeat || isYouSocket);
    if (!id) {
      return {
        label: isYou ? `You (${entry.mark})` : `Player ${entry.mark}`,
        detail: isMultiplayer ? "Seat open" : "Local match",
        isYou,
      };
    }
    return {
      label: isYou ? `You (${entry.mark})` : `Player ${entry.mark}`,
      detail: shortId,
      isYou,
    };
  };

  const timelineItems = history.map((entry, index) => ({
    entry,
    index,
    actor: resolveActor(entry),
  }));

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-100">
            Game Timeline
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Viewing move {safeIndex} of {totalMoves}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          >
            Close
          </button>
        )}
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/90 to-white/30 p-4 shadow-sm dark:border-slate-700 dark:from-slate-800/70 dark:to-slate-900/30">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {isLiveView ? "Live view" : "Time travel"}
            </span>
            <span>{new Date(activeEntry?.timestamp ?? Date.now()).toLocaleTimeString()}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {winner ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <Crown size={20} />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <ValueMark value={activeEntry?.mark || currentTurn || ""} />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {statusLine}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeEntry?.result || (winner ? "Awaiting rematch" : "Follow each move in order")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {timelineItems.length ? (
          <ul className="space-y-3">
            {timelineItems.map(({ entry, index, actor }) => (
              <HistoryItem
                key={entry?.id || index}
                entry={entry}
                index={index}
                active={index === safeIndex}
                onSelect={() => jumpTo(index)}
                actor={actor}
                isLast={index === timelineItems.length - 1}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            No moves yet. Start playing to populate the timeline.
          </div>
        )}
      </div>

      {history.length > 1 && safeIndex < history.length - 1 && (
        <div className="px-4">
          <Tooltip content="Jump back to the live board">
            <button
              type="button"
              onClick={resumeLatest}
              className="mb-4 w-full rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
            >
              Resume Live
            </button>
          </Tooltip>
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Completed Games</span>
          {completedGames.length > 0 && (
            <span>{completedGames.length}</span>
          )}
        </div>
        <div className="mt-2 space-y-3 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {completedGames.length ? (
            completedGames
              .slice()
              .reverse()
              .map((game) => {
                const sequence = formatSequence(game.sequence);
                const finishedLabel = game.finishedAt
                  ? new Date(game.finishedAt).toLocaleTimeString()
                  : "";
                return (
                  <div
                    key={game.id}
                    className="rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-100">
                      <span className="flex items-center gap-2">
                        {game.draw ? (
                          <RefreshCcw size={14} className="text-amber-500" />
                        ) : (
                          <Crown size={14} className="text-emerald-500" />
                        )}
                        {game.draw ? "Draw" : `${game.winner} Victory`}
                      </span>
                      <span className="text-[11px] font-normal uppercase text-slate-400 dark:text-slate-500">
                        {finishedLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Total moves: {game.totalMoves ?? sequence.length}
                      </div>
                      {sequence.length ? (
                        <Tooltip content={sequence.join(" → ")}
                          side="top"
                        >
                          <div className="truncate text-xs font-mono text-slate-600 dark:text-slate-300">
                            {sequence.join(" · ")}
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="text-xs italic text-slate-400 dark:text-slate-500">
                          Sequence unavailable
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Finish a match to start building your archive.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;

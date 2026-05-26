import { useMemo } from "react";
import HistoryItem from "./HistoryItem";
import { Tooltip } from "./ui/Tooltip";
import ValueMark from "./marks/ValueMark";
import Crown from "lucide-react/dist/esm/icons/crown.js";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw.js";
import Users from "lucide-react/dist/esm/icons/users.js";
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
    <div className="flex h-full flex-col bg-card/85 text-foreground backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-foreground/5 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Game Timeline
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Viewing move {safeIndex} of {totalMoves}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            Close
          </button>
        )}
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-3xl border border-foreground/5 bg-foreground/[0.03] p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {isLiveView ? "Live view" : "Time travel"}
            </span>
            <span>{new Date(activeEntry?.timestamp ?? Date.now()).toLocaleTimeString()}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {winner ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/15 bg-amber-500/10 text-amber-500">
                <Crown size={20} />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.04] text-foreground">
                <ValueMark value={activeEntry?.mark || currentTurn || ""} />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {statusLine}
              </p>
              <p className="text-xs text-muted-foreground">
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
          <div className="rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
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
              className="mb-4 w-full rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              Resume Live
            </button>
          </Tooltip>
        </div>
      )}

      <div className="border-t border-foreground/5 bg-background/60 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
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
                    className="rounded-2xl border border-foreground/5 bg-foreground/[0.03] p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                      <span className="flex items-center gap-2">
                        {game.draw ? (
                          <RefreshCcw size={14} className="text-amber-500" />
                        ) : (
                          <Crown size={14} className="text-emerald-500" />
                        )}
                        {game.draw ? "Draw" : `${game.winner} Victory`}
                      </span>
                      <span className="text-[11px] font-normal uppercase text-muted-foreground">
                        {finishedLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <div className="text-xs text-muted-foreground">
                        Total moves: {game.totalMoves ?? sequence.length}
                      </div>
                      {sequence.length ? (
                        <Tooltip content={sequence.join(" → ")}
                          side="top"
                        >
                          <div className="truncate text-xs font-mono text-foreground/75">
                            {sequence.join(" · ")}
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="text-xs italic text-muted-foreground">
                          Sequence unavailable
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="rounded-2xl border border-dashed border-foreground/10 px-3 py-4 text-sm text-muted-foreground">
              Finish a match to start building your archive.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;

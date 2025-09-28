import React from "react";
import { Tooltip } from "./ui/Tooltip";
import ValueMark from "./marks/ValueMark";
import { CircleDot, Clock3, Crown, RefreshCcw } from "lucide-react";

const ICON_MAP = {
  win: Crown,
  draw: CircleDot,
  reset: RefreshCcw,
  system: CircleDot,
};

const HistoryItem = ({ entry, index, onSelect, active, actor, isLast }) => {
  const moveLabel = index === 0 ? "Start" : `Move ${entry?.move ?? index}`;
  const coordinateLabel =
    entry?.mark && entry?.coordinate
      ? `${entry.mark}@${entry.coordinate}`
      : entry?.coordinate || null;
  const tooltipContent = [
    moveLabel,
    coordinateLabel,
    actor?.label,
    entry?.result,
  ]
    .filter(Boolean)
    .join(" • ");

  const Icon = ICON_MAP[entry?.type] || Clock3;

  return (
    <li className="relative pl-9">
      {!isLast && (
        <span className="absolute left-[13px] top-10 bottom-[-16px] w-px bg-slate-200 dark:bg-slate-700" />
      )}
      <Tooltip content={tooltipContent} side="left" align="center">
        <button
          type="button"
          onClick={() => onSelect(index)}
          className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:focus-visible:ring-blue-500 ${
            active
              ? "border-blue-300 bg-blue-50/90 shadow-sm dark:border-blue-700 dark:bg-blue-900/20"
              : "border-transparent bg-white/20 hover:border-slate-200 hover:bg-slate-100/60 dark:border-slate-800/40 dark:bg-slate-800/30 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
          }`}
          aria-label={tooltipContent}
        >
          <div className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border bg-white text-sm dark:border-slate-700 dark:bg-slate-900">
            {entry?.mark ? (
              <ValueMark value={entry.mark} />
            ) : (
              <Icon size={14} className="text-slate-500 dark:text-slate-400" />
            )}
          </div>
          <div className="ml-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{moveLabel}</span>
              {coordinateLabel && (
                <span className="font-semibold text-slate-600 dark:text-slate-200">
                  {coordinateLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className={`text-sm font-semibold ${
                    actor?.isYou
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {actor?.label || "System"}
                </p>
                {actor?.detail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {actor.detail}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {entry?.result}
              </span>
            </div>
          </div>
        </button>
      </Tooltip>
    </li>
  );
};

export default HistoryItem;

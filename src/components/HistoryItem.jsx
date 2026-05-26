import React from "react";
import { Tooltip } from "./ui/Tooltip";
import ValueMark from "./marks/ValueMark";
import CircleDot from "lucide-react/dist/esm/icons/circle-dot.js";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.js";
import Crown from "lucide-react/dist/esm/icons/crown.js";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw.js";

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
        <span className="absolute left-[13px] top-10 bottom-[-16px] w-px bg-border" />
      )}
      <Tooltip content={tooltipContent} side="left" align="center">
        <button
          type="button"
          onClick={() => onSelect(index)}
          className={`w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
            active
              ? "border-foreground/15 bg-foreground/[0.06] shadow-sm"
              : "border-foreground/5 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
          }`}
          aria-label={tooltipContent}
        >
          <div className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-card text-sm">
            {entry?.mark ? (
              <ValueMark value={entry.mark} />
            ) : (
              <Icon size={14} className="text-muted-foreground" />
            )}
          </div>
          <div className="ml-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{moveLabel}</span>
              {coordinateLabel && (
                <span className="font-semibold text-foreground/75">
                  {coordinateLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className={`text-sm font-semibold ${
                    actor?.isYou
                      ? "text-foreground"
                      : "text-foreground/85"
                  }`}
                >
                  {actor?.label || "System"}
                </p>
                {actor?.detail && (
                  <p className="text-xs text-muted-foreground">
                    {actor.detail}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
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

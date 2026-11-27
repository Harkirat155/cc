import React from "react";
import { LEVELS } from "@shared/ai/bot.js";

const GROUP =
  "flex items-center p-1 bg-foreground/[0.03] border border-foreground/5 rounded-full";
const BUTTON =
  "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20";

const Segmented = ({ label, options, value, onChange }) => (
  <div className={GROUP} role="group" aria-label={label}>
    {options.map(([key, text]) => (
      <button
        key={key}
        type="button"
        aria-pressed={key === value}
        onClick={() => onChange(key)}
        className={`${BUTTON} ${
          key === value
            ? "bg-foreground/10 text-foreground shadow-sm"
            : "text-foreground/50 hover:text-foreground/80"
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

const OpponentControl = ({ opponent, onChange }) => (
  <div className="flex flex-wrap items-center justify-center gap-2" data-testid="opponent-control">
    <Segmented
      label="Opponent"
      options={[["human", "Human"], ["computer", "Computer"]]}
      value={opponent.mode}
      onChange={(mode) => onChange({ mode })}
    />
    {opponent.mode === "computer" && (
      <>
        <Segmented
          label="Computer level"
          options={LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)])}
          value={opponent.level}
          onChange={(level) => onChange({ level })}
        />
        <Segmented
          label="Your seat"
          options={[["0", "Go first"], ["1", "Go second"]]}
          value={String(opponent.humanSlot)}
          onChange={(slot) => onChange({ humanSlot: Number(slot) })}
        />
      </>
    )}
  </div>
);

export default OpponentControl;

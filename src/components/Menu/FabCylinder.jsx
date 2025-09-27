import React from "react";
import { Tooltip } from "../ui/Tooltip.jsx";

export default function FabCylinder({
  height,
  indicators = [],
  expanded,
  onToggle,
}) {
  return (
    <Tooltip content={expanded ? "Close quick menu" : "Open quick menu"} side="left">
      <button
        type="button"
        aria-label={expanded ? "Close menu" : "Open menu"}
        aria-expanded={expanded}
        aria-controls="menu-panel-popover"
        onClick={onToggle}
        className="group fixed bottom-4 right-4 z-40 outline-none"
        tabIndex={expanded ? -1 : 0}
      >
        <span
          className={`relative block w-[58px] rounded-full shadow-2xl ring-1 ring-white/25 border border-white/20 dark:border-gray-700/50 backdrop-blur-xl backdrop-saturate-150 bg-white/25 dark:bg-gray-800/25 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35 transition-transform duration-200 ${
            expanded ? "opacity-0 pointer-events-none scale-90 translate-y-1" : "opacity-100 scale-100"
          }`}
          style={{ height }}
        >
          <span className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full bg-white/25 blur-[2px] opacity-70" />
          <span className="pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-full bg-black/30 dark:bg-black/40 blur-[2px] opacity-60" />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {indicators.map((cls, i) => (
              <span key={i} className={`w-7 h-7 rounded-full ring-2 ring-white/70 dark:ring-white/50 shadow-md opacity-95 ${cls}`} />
            ))}
          </span>
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_28px_6px_rgba(255,255,255,0.22)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="pointer-events-none absolute -inset-1 rounded-[999px] ring-2 ring-blue-300/40 opacity-0 group-focus-visible:opacity-100 transition-opacity" />
        </span>
      </button>
    </Tooltip>
  );
}

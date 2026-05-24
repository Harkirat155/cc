import React from 'react';

// Per-slot color → Tailwind classes. Tailwind needs literal class names so
// this whitelist is intentional. Add a new entry when a game introduces a
// new color token in its rules' playerInfo.
const COLOR_CLASSES = {
  sky:    'text-blue-600 dark:text-blue-400 dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.45)]',
  rose:   'text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]',
  red:    'text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]',
  amber:  'text-amber-500 dark:text-amber-300 dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]',
  emerald:'text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.45)]',
};

// Legacy X/O fallback keeps existing TTT visuals identical when callers
// don't pass playerInfo (e.g. the local-mode bootstrap before a game spec
// is hydrated).
const LEGACY_BY_MARK = { X: COLOR_CLASSES.sky, O: COLOR_CLASSES.rose };

function pickColorClass(value, playerInfo) {
  if (Array.isArray(playerInfo)) {
    const slot = playerInfo.findIndex((p) => p?.label === value);
    if (slot >= 0) return COLOR_CLASSES[playerInfo[slot].color] || '';
  }
  return LEGACY_BY_MARK[value] || '';
}

const ValueMark = ({ value, playerInfo }) => {
  if (!value || value === '') return <span className="transition-all duration-300"></span>;
  const colorClass = pickColorClass(value, playerInfo);
  return (
    <span className={`transition-all duration-300 ${colorClass}`}>{value}</span>
  );
};

export default ValueMark;
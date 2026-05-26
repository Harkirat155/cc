import React, { memo } from 'react';

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
const FALLBACK_SLOT = { X: 0, R: 0, Red: 0, O: 1, Y: 1, Yellow: 1 };

function pickPaletteClass(value, playerInfo, palette) {
  if (!palette) return '';

  if (Array.isArray(playerInfo)) {
    const exact = playerInfo.find((p) => p?.label === value);
    if (exact?.slot === 0) return palette.p1?.color || '';
    if (exact?.slot === 1) return palette.p2?.color || '';

    const byInitial = playerInfo.find((p) => p?.label?.charAt(0) === value);
    if (byInitial?.slot === 0) return palette.p1?.color || '';
    if (byInitial?.slot === 1) return palette.p2?.color || '';
  }

  if (FALLBACK_SLOT[value] === 0) return palette.p1?.color || '';
  if (FALLBACK_SLOT[value] === 1) return palette.p2?.color || '';
  return '';
}

function pickDisplayValue(value, playerInfo, palette) {
  if (!palette) return value;

  if (Array.isArray(playerInfo)) {
    const exact = playerInfo.find((p) => p?.label === value);
    if (exact?.slot === 0) return palette.p1?.symbol || value;
    if (exact?.slot === 1) return palette.p2?.symbol || value;

    const byInitial = playerInfo.find((p) => p?.label?.charAt(0) === value);
    if (byInitial?.slot === 0) return palette.p1?.symbol || value;
    if (byInitial?.slot === 1) return palette.p2?.symbol || value;
  }

  if (FALLBACK_SLOT[value] === 0) return palette.p1?.symbol || value;
  if (FALLBACK_SLOT[value] === 1) return palette.p2?.symbol || value;
  return value;
}

function pickColorClass(value, playerInfo, palette) {
  const paletteClass = pickPaletteClass(value, playerInfo, palette);
  if (paletteClass) return paletteClass;

  if (Array.isArray(playerInfo)) {
    const slot = playerInfo.findIndex((p) => p?.label === value);
    if (slot >= 0) return COLOR_CLASSES[playerInfo[slot].color] || '';
  }
  return LEGACY_BY_MARK[value] || '';
}

function markShapeClass() {
  return 'inline-flex items-center justify-center leading-none';
}

function samePlayerInfo(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((player, index) => {
    const next = b[index];
    return player?.slot === next?.slot && player?.label === next?.label && player?.color === next?.color;
  });
}

const ValueMark = memo(function ValueMark({ value, playerInfo, palette }) {
  if (!value || value === '') return <span className="transition-all duration-300"></span>;
  const colorClass = pickColorClass(value, playerInfo, palette);
  const displayValue = pickDisplayValue(value, playerInfo, palette);
  if (displayValue === '○') {
    return (
      <span
        role="img"
        aria-label="○"
        className={`transition-all duration-300 ${markShapeClass()} ${colorClass}`}
      >
        <span
          aria-hidden="true"
          className="block h-[1em] w-[1em] rounded-full border-[0.08em] border-current"
        />
      </span>
    );
  }
  return (
    <span className={`transition-all duration-300 ${markShapeClass()} ${colorClass}`}>{displayValue}</span>
  );
}, (prev, next) => (
  prev.value === next.value &&
  samePlayerInfo(prev.playerInfo, next.playerInfo) &&
  prev.palette === next.palette
));

export default ValueMark;
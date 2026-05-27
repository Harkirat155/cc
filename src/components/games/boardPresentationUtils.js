const FALLBACK_SLOT = {
  X: 0,
  R: 0,
  Red: 0,
  O: 1,
  Y: 1,
  Yellow: 1,
};

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function slotForValue(value, playerInfo) {
  if (value && typeof value === "object") return Number.isInteger(value.owner) ? value.owner : null;
  if (Array.isArray(playerInfo)) {
    const exact = playerInfo.find((p) => p?.label === value);
    if (exact && Number.isInteger(exact.slot)) return exact.slot;
    const byInitial = playerInfo.find((p) => p?.label?.charAt(0) === value);
    if (byInitial && Number.isInteger(byInitial.slot)) return byInitial.slot;
  }
  return Object.prototype.hasOwnProperty.call(FALLBACK_SLOT, value) ? FALLBACK_SLOT[value] : null;
}

export function paletteForValue(value, playerInfo, palette) {
  const slot = slotForValue(value, playerInfo);
  if (slot === 0) return palette?.p1;
  if (slot === 1) return palette?.p2;
  return null;
}

export function samePieceValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return a.owner === b.owner && a.type === b.type;
}

export function samePlayerInfo(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a.length === b.length && a.every((player, index) => {
    const next = b[index];
    return player?.slot === next?.slot && player?.label === next?.label && player?.color === next?.color;
  });
}

export function revealClasses(reducedMotion) {
  return reducedMotion ? "" : "animate-piece-reveal";
}

export function squareClasses({
  gameId,
  isWinning,
  isSelected,
  isLegalTarget,
  isDarkSquare,
  isColumnHighlighted,
  hasSelectionFlow,
  hasValue,
  isPressed,
}) {
  const base =
    "group relative flex aspect-square items-center justify-center border transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default";

  if (gameId === "connect4") {
    return cx(
      base,
      "rounded-2xl border-transparent bg-transparent p-1 sm:p-1.5",
      isColumnHighlighted
        ? "bg-foreground/[0.04]"
        : "hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04]",
      isWinning && "z-10",
      isPressed && "scale-95",
      hasValue ? "cursor-default" : "cursor-pointer"
    );
  }

  if (gameId === "checkers") {
    return cx(
      base,
      "h-8 w-8 rounded-none border-0 text-foreground shadow-none sm:h-12 sm:w-12",
      isDarkSquare
        ? "bg-foreground/[0.04] hover:bg-foreground/[0.06]"
        : "border-transparent bg-transparent",
      isSelected && "z-10 bg-foreground/[0.08] ring-2 ring-foreground/30",
      isLegalTarget && "bg-emerald-400/10 ring-2 ring-emerald-400/60",
      isPressed && "scale-95",
      hasSelectionFlow ? "cursor-pointer" : "cursor-default"
    );
  }

  return cx(
    base,
    "h-[4.5rem] w-[4.5rem] rounded-2xl border-foreground/5 bg-foreground/[0.03] text-4xl font-light text-foreground hover:bg-foreground/[0.06] min-[360px]:h-20 min-[360px]:w-20 sm:h-28 sm:w-28 sm:text-5xl",
    isWinning && "z-10 scale-105 border-foreground/20 bg-foreground/10 shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(255,255,255,0.1)]",
    isPressed && "scale-95",
    hasValue ? "cursor-default" : "cursor-pointer"
  );
}

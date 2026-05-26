export const DEFAULT_GAME_PALETTE = {
  displayName: "Tic-Tac-Toe",
  p1: {
    label: "Player X",
    symbol: "✕",
    color: "text-indigo-500 dark:text-indigo-400",
    glow: "bg-indigo-500",
    piece: "bg-indigo-500 dark:bg-indigo-400",
    ring: "ring-indigo-400/80 dark:ring-indigo-400/70",
  },
  p2: {
    label: "Player O",
    symbol: "○",
    color: "text-orange-500 dark:text-orange-400",
    glow: "bg-orange-500",
    piece: "bg-orange-500 dark:bg-orange-400",
    ring: "ring-orange-400/80 dark:ring-orange-400/70",
  },
};

export const GAME_PALETTES = {
  ttt: DEFAULT_GAME_PALETTE,
  connect4: {
    displayName: "Connect Four",
    p1: {
      label: "Player Red",
      symbol: "",
      color: "text-red-500 dark:text-red-400",
      glow: "bg-red-500",
      piece: "bg-red-500 border-red-400/50 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.4),_0_0_15px_rgba(239,68,68,0.4)]",
      ring: "ring-red-400/70",
    },
    p2: {
      label: "Player Yellow",
      symbol: "",
      color: "text-yellow-500 dark:text-yellow-300",
      glow: "bg-yellow-400",
      piece: "bg-yellow-400 border-yellow-300/50 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.4),_0_0_15px_rgba(250,204,21,0.4)]",
      ring: "ring-yellow-300/70",
    },
  },
  checkers: {
    displayName: "Checkers",
    p1: {
      label: "Player R",
      symbol: "",
      color: "text-red-500 dark:text-red-400",
      glow: "bg-red-500",
      piece: "bg-red-500 border-red-400/50 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)]",
      ring: "ring-red-400/70",
    },
    p2: {
      label: "Player Y",
      symbol: "",
      color: "text-amber-500 dark:text-amber-300",
      glow: "bg-amber-500",
      piece: "bg-amber-600 border-amber-500/50 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)]",
      ring: "ring-amber-400/70",
    },
  },
};

export function getGamePalette(gameId) {
  return GAME_PALETTES[gameId] || DEFAULT_GAME_PALETTE;
}

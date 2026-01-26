/**
 * Game mode configurations
 * Extensible for future modes (e.g., 4x4, 7x7)
 */
export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    icon: '⚡',
    description: 'Quick 3×3 game',
    size: 3,
    streak: 3,
    aiDepth: 6,
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    icon: '🎯',
    description: 'Strategic 5×5 board',
    size: 5,
    streak: 4,
    aiDepth: 4,
  },
};

export const DEFAULT_MODE = 'classic';

/**
 * Get mode config by id
 * @param {string} modeId
 * @returns {Object}
 */
export function getModeConfig(modeId) {
  return GAME_MODES[modeId] || GAME_MODES[DEFAULT_MODE];
}

/**
 * Create empty board for a given mode
 * @param {string} modeId
 * @returns {string[]}
 */
export function createEmptyBoard(modeId) {
  const { size } = getModeConfig(modeId);
  return Array(size * size).fill('');
}

/**
 * Get persisted game mode from localStorage
 * @returns {string}
 */
export function getPersistedMode() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return DEFAULT_MODE;
  const stored = window.localStorage.getItem('gameMode');
  return stored && GAME_MODES[stored] ? stored : DEFAULT_MODE;
}

/**
 * Persist game mode to localStorage
 * @param {string} modeId
 */
export function setPersistedMode(modeId) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  if (GAME_MODES[modeId]) {
    window.localStorage.setItem('gameMode', modeId);
  }
}

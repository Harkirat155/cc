// Input validation helpers for socket handlers

/**
 * Validate and normalize room ID
 * @param {string} roomId - Room ID to validate
 * @returns {string|null} Normalized room ID or null if invalid
 */
export function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') return null;
  const normalized = roomId.trim().toUpperCase();
  if (normalized.length !== 5 || !/^[A-Z0-9]+$/.test(normalized)) return null;
  return normalized;
}

/**
 * Validate display name
 * @param {string} name - Display name to validate
 * @returns {string|null} Validated name or null if invalid
 */
export function validateDisplayName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 20);
  return trimmed.length >= 2 ? trimmed : null;
}

/**
 * Validate board index
 * @param {number} index - Board index to validate
 * @param {number} maxIndex - Maximum valid index (exclusive), defaults to 9 for 3x3
 * @returns {boolean} True if valid
 */
export function validateIndex(index, maxIndex = 9) {
  return Number.isInteger(index) && index >= 0 && index < maxIndex;
}

/**
 * Validate game mode
 * @param {string} mode - Game mode to validate
 * @returns {string} Valid game mode or 'classic' as default
 */
export function validateGameMode(mode) {
  const validModes = ['classic', 'ultimate'];
  if (mode && typeof mode === 'string' && validModes.includes(mode)) {
    return mode;
  }
  return 'classic';
}

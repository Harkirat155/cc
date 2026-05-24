// Input validation helpers for socket handlers

import '../../shared/games/index.js';
import { has as hasGame } from '../../shared/games/registry.js';

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
 * @returns {boolean} True if valid
 */
export function validateIndex(index) {
  return Number.isInteger(index) && index >= 0 && index <= 8;
}

/**
 * Validate and normalize a registered game id
 * @param {string} gameId - Game id to validate
 * @returns {string|null} Normalized game id or null if invalid
 */
export function validateGameId(gameId) {
  if (!gameId || typeof gameId !== 'string') return null;
  const normalized = gameId.trim().toLowerCase();
  return hasGame(normalized) ? normalized : null;
}

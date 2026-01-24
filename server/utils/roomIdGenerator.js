/**
 * Room creation utilities
 * Single Responsibility: Handle room ID generation and validation
 */

import { genCode } from '../gameLogic.js';
import { rooms } from '../roomManager.js';

const MAX_ROOM_ID_GENERATION_ATTEMPTS = 10;

/**
 * Generate a unique room ID
 * @returns {Object} Result object with roomId or error
 */
export function generateUniqueRoomId() {
  let roomId = genCode();
  let attempts = 0;
  
  while (rooms.has(roomId) && attempts < MAX_ROOM_ID_GENERATION_ATTEMPTS) {
    roomId = genCode();
    attempts++;
  }

  if (rooms.has(roomId)) {
    return {
      success: false,
      error: `Failed to generate unique room code after ${MAX_ROOM_ID_GENERATION_ATTEMPTS} attempts`,
    };
  }

  return {
    success: true,
    roomId,
  };
}

/**
 * Validate that a room ID is available
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} True if room ID is available
 */
export function isRoomIdAvailable(roomId) {
  return !rooms.has(roomId);
}

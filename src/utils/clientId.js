/**
 * Client identity utilities for stable session identification.
 * Used for seat restoration across reconnects.
 */

const CLIENT_ID_KEY = "cc_client_id";
const ROOM_ID_KEY = "cc_room_id";

/**
 * Generate a random client ID
 */
function generateClientId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Get or create a stable client ID for this browser session.
 * Stored in sessionStorage so it persists across page refreshes but not browser restarts.
 */
export function getClientId() {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = generateClientId();
        window.sessionStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    }
  } catch {
    // sessionStorage not available
  }
  return generateClientId();
}

/**
 * Persist room ID for reconnection purposes
 */
export function setPersistedRoom(roomId) {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (roomId) {
        window.sessionStorage.setItem(ROOM_ID_KEY, roomId);
      } else {
        window.sessionStorage.removeItem(ROOM_ID_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Get persisted room ID for reconnection
 */
export function getPersistedRoom() {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(ROOM_ID_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

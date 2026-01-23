import { useState, useCallback } from "react";

/**
 * Hook for lobby matchmaking state and actions.
 * Manages lobby queue, error state, and join/leave operations.
 * 
 * @param {object} options
 * @param {Function} options.getSocket - Function to get existing socket instance
 * @param {Function} [options.ensureSocket] - Function to ensure socket is initialized
 * @returns {object} Lobby state and actions
 */
export default function useLobby({ getSocket, ensureSocket }) {
  const [lobbyQueue, setLobbyQueue] = useState([]);
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  /**
   * Join the matchmaking lobby
   * @param {string} displayName - Player's display name
   * @returns {Promise} Resolves on success, rejects with error
   */
  const joinLobby = useCallback((displayName) => {
    return new Promise((resolve, reject) => {
      const socket = ensureSocket?.() || getSocket?.();
      if (!socket) {
        reject(new Error("Socket not available"));
        return;
      }

      setLobbyError(null);

      socket.emit("joinLobby", { displayName }, (response) => {
        if (response?.success) {
          setIsInLobby(true);
          resolve(response);
        } else {
          const error = response?.error || "Failed to join lobby";
          setLobbyError(error);
          reject(new Error(error));
        }
      });
    });
  }, [getSocket, ensureSocket]);

  /**
   * Leave the matchmaking lobby
   * @returns {Promise} Resolves when left
   */
  const leaveLobby = useCallback(() => {
    return new Promise((resolve) => {
      const socket = getSocket?.();
      if (!socket) {
        resolve();
        return;
      }

      socket.emit("leaveLobby", (response) => {
        setIsInLobby(false);
        setLobbyError(null);
        resolve(response);
      });
    });
  }, [getSocket]);

  /**
   * Handle lobby update event from server
   * @param {object} data - Lobby update payload
   */
  const handleLobbyUpdate = useCallback(({ queue }) => {
    setLobbyQueue(queue || []);
  }, []);

  /**
   * Handle match found - clears lobby state
   */
  const handleMatchFound = useCallback(() => {
    setIsInLobby(false);
    setLobbyError(null);
  }, []);

  return {
    lobbyQueue,
    isInLobby,
    lobbyError,
    joinLobby,
    leaveLobby,
    // Event handlers for socket setup
    handleLobbyUpdate,
    handleMatchFound,
  };
}

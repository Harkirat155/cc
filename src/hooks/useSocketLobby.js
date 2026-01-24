import { useState, useCallback } from "react";

/**
 * Hook for lobby operations
 * Single Responsibility: Manage lobby state and operations
 * 
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.ensureSocket - Function to ensure socket is initialized
 * @param {Function} dependencies.waitForConnection - Function to wait for socket connection
 * @returns {Object} Lobby state and operations
 */
export function useSocketLobby({ ensureSocket, waitForConnection }) {
  const [lobbyQueue, setLobbyQueue] = useState([]);
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  /**
   * Join the matchmaking lobby
   */
  const joinLobby = useCallback(async (displayName) => {
    setLobbyError(null);

    try {
      ensureSocket();
      const socket = await waitForConnection();
      
      console.log("[Lobby] Socket connected, emitting joinLobby with name:", displayName);
      
      return new Promise((resolve, reject) => {
        socket.emit("joinLobby", { displayName }, (response) => {
          console.log("[Lobby] joinLobby response:", response);
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
    } catch (err) {
      console.error("[Lobby] Failed to connect:", err);
      setLobbyError("Connection failed");
      throw err;
    }
  }, [ensureSocket, waitForConnection]);

  /**
   * Leave the matchmaking lobby
   */
  const leaveLobby = useCallback((socketRef) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        setIsInLobby(false);
        resolve();
        return;
      }

      const socket = socketRef.current;
      if (!socket.connected) {
        setIsInLobby(false);
        resolve();
        return;
      }

      socket.emit("leaveLobby", (response) => {
        setIsInLobby(false);
        setLobbyError(null);
        resolve(response);
      });
    });
  }, []);

  return {
    // State
    lobbyQueue,
    isInLobby,
    lobbyError,
    
    // Operations
    joinLobby,
    leaveLobby,
    
    // State setters (for event handlers)
    setLobbyQueue,
    setIsInLobby,
    setLobbyError,
  };
}

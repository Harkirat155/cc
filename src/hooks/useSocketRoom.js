import { useState, useCallback } from "react";
import { getDisplayName } from "../utils/randomName";
import { setPersistedRoom } from "../utils/clientId";

/**
 * Hook for room operations
 * Single Responsibility: Manage room state and operations
 * 
 * @param {Object} dependencies - External dependencies
 * @param {Function} dependencies.ensureSocket - Function to ensure socket is initialized
 * @param {Function} dependencies.waitForConnection - Function to wait for socket connection
 * @param {Object} dependencies.clientIdRef - Ref containing client ID
 * @param {Function} dependencies.finalizeCurrentGame - Function to finalize current game
 * @param {Function} dependencies.resetHistory - Function to reset game history
 * @returns {Object} Room state and operations
 */
export function useSocketRoom({ 
  ensureSocket, 
  waitForConnection, 
  clientIdRef,
  finalizeCurrentGame,
  resetHistory 
}) {
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [roster, setRoster] = useState({ X: null, O: null, spectators: [] });
  const [voiceRoster, setVoiceRoster] = useState({});
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [message, setMessage] = useState("Local game ready");

  const isMultiplayer = !!roomId;

  /**
   * Create a new multiplayer room
   */
  const createRoom = useCallback(async () => {
    const currentDisplayName = getDisplayName();
    
    try {
      ensureSocket();
      const socket = await waitForConnection();
      socket.emit("createRoom", { clientId: clientIdRef.current, displayName: currentDisplayName }, (resp) => {
        if (resp?.error) {
          setMessage(resp.error);
          return;
        }
        setRoomId(resp.roomId);
        setPlayer(resp.player);
        setIsRoomCreator(true);
        setMessage(`Room ${resp.roomId} created. Waiting for opponent...`);
        setPersistedRoom(resp.roomId);
      });
    } catch (err) {
      console.error("[Room] Failed to create room:", err);
      setMessage("Connection failed");
    }
  }, [ensureSocket, waitForConnection, clientIdRef]);

  /**
   * Join an existing room
   */
  const joinRoom = useCallback(async (code) => {
    const currentDisplayName = getDisplayName();
    
    try {
      ensureSocket();
      const socket = await waitForConnection();
      socket.emit(
        "joinRoom",
        { roomId: code, clientId: clientIdRef.current, displayName: currentDisplayName },
        (resp) => {
          if (resp?.error) {
            setMessage(resp.error);
            if (resp.error === "Room not found") setPersistedRoom(null);
            return;
          }
          if (resp?.player) setPlayer(resp.player);
          setRoomId(code);
          setPersistedRoom(code);
          setMessage(`Joined room ${code} as ${resp?.player || 'spectator'}`);
        }
      );
    } catch (err) {
      console.error("[Room] Failed to join room:", err);
      setMessage("Connection failed");
    }
  }, [ensureSocket, waitForConnection, clientIdRef]);

  /**
   * Leave the current room
   */
  const leaveRoom = useCallback((socketRef, gameWinner) => {
    return new Promise((resolve) => {
      if (!isMultiplayer) {
        resolve();
        return;
      }

      finalizeCurrentGame(gameWinner);

      if (socketRef.current?.connected) {
        socketRef.current.emit("leaveRoom", { roomId, clientId: clientIdRef.current });
      }

      setRoomId(null);
      setPlayer(null);
      setIsRoomCreator(false);
      setRoster({ X: null, O: null, spectators: [] });
      setMessage("Left room");
      setPersistedRoom(null);
      resetHistory("Left room", "system");
      resolve();
    });
  }, [isMultiplayer, roomId, clientIdRef, finalizeCurrentGame, resetHistory]);

  return {
    // State
    roomId,
    player,
    roster,
    voiceRoster,
    isRoomCreator,
    isMultiplayer,
    message,
    
    // Operations
    createRoom,
    joinRoom,
    leaveRoom,
    
    // State setters (for event handlers)
    setRoomId,
    setPlayer,
    setRoster,
    setVoiceRoster,
    setMessage,
  };
}

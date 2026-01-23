import { useCallback, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getClientId, getPersistedRoom, setPersistedRoom } from "../utils/clientId";
import { getDisplayName } from "../utils/randomName";

/**
 * Hook for managing Socket.IO connection, reconnection, and connection state.
 * Handles lazy socket initialization, auto-reconnection to rooms, and connection status tracking.
 *
 * @param {object} options
 * @param {string|null} options.roomId - Current room ID (for reconnection logic)
 * @param {string|null} options.player - Current player role
 * @param {Function} options.onRejoin - Callback when room is rejoined (receives { player, roomId })
 * @param {Function} options.setMessage - Function to update status message
 * @returns {object} Socket state and utilities
 */
export default function useSocketConnection({
  roomId,
  player,
  onRejoin,
  setMessage,
}) {
  const socketRef = useRef(null);
  const clientIdRef = useRef(getClientId());
  const pendingJoinRef = useRef(null);
  const joinOnConnectHandlerRef = useRef(null);

  const [connectionState, setConnectionState] = useState("disconnected");

  /**
   * Lazily initialize socket connection.
   * Returns existing socket or creates new one with event handlers.
   */
  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const url =
      import.meta.env.VITE_SOCKET_SERVER ||
      window.location.origin.replace(/:\d+$/, ":10000");

    const socket = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionState("disconnected");
    });

    socket.on("connect", () => {
      setConnectionState("connected");
      setMessage?.(roomId ? `Connected as ${player || ""}` : "Connected");

      // Handle pending join request
      if (pendingJoinRef.current) {
        const code = pendingJoinRef.current;
        pendingJoinRef.current = null;
        socket.emit(
          "joinRoom",
          { roomId: code, clientId: clientIdRef.current, displayName: getDisplayName() },
          (resp) => {
            if (resp?.error) {
              setMessage?.(resp.error);
              return;
            }
            onRejoin?.({ player: resp.player, roomId: code });
          }
        );
      }

      // Auto-rejoin room after transient disconnect
      try {
        const saved = getPersistedRoom();
        const toJoin = roomId || saved;
        if (toJoin) {
          socket.emit(
            "joinRoom",
            { roomId: toJoin, clientId: clientIdRef.current, displayName: getDisplayName() },
            (resp) => {
              if (resp?.error) {
                setMessage?.(resp.error);
                if (resp.error === "Room not found") setPersistedRoom(null);
                return;
              }
              onRejoin?.({ player: resp.player, roomId: toJoin });
            }
          );
        }
      } catch {
        // ignore
      }
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setMessage?.("Disconnected");
    });

    socketRef.current = socket;
    return socket;
  }, [roomId, player, onRejoin, setMessage]);

  /**
   * Get current socket instance (may be null)
   */
  const getSocket = useCallback(() => socketRef.current, []);

  /**
   * Get stable client ID for this session
   */
  const getClientIdValue = useCallback(() => clientIdRef.current, []);

  /**
   * Set pending join for when socket connects
   */
  const setPendingJoin = useCallback((code) => {
    pendingJoinRef.current = code;
  }, []);

  /**
   * Handle the joinOnConnect pattern to avoid stacking listeners
   */
  const getJoinOnConnectHandler = useCallback(() => joinOnConnectHandlerRef.current, []);
  const setJoinOnConnectHandler = useCallback((handler) => {
    joinOnConnectHandlerRef.current = handler;
  }, []);

  /**
   * Disconnect socket (for cleanup)
   */
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return {
    connectionState,
    ensureSocket,
    getSocket,
    getClientId: getClientIdValue,
    setPendingJoin,
    getJoinOnConnectHandler,
    setJoinOnConnectHandler,
    disconnect,
  };
}

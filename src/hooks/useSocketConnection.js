/**
 * Socket Connection Hook
 * Single Responsibility: Manage socket connection state
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { getSocket, waitForConnection, isConnected, addListener } from "../utils/socketManager";

/**
 * Hook for socket connection management
 * @returns {Object} Connection state and utilities
 */
export function useSocketConnection() {
  const [connectionState, setConnectionState] = useState(isConnected() ? "connected" : "disconnected");
  const socketRef = useRef(null);
  const handlersRegisteredRef = useRef(false);

  /**
   * Ensure socket is initialized
   */
  const ensureSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
      handlersRegisteredRef.current = false;
    }
    return socketRef.current;
  }, []);

  /**
   * Wait for socket connection
   */
  const waitForSocketConnection = useCallback(async () => {
    ensureSocket();
    return await waitForConnection();
  }, [ensureSocket]);

  // Monitor connection state changes
  useEffect(() => {
    const cleanup = addListener((event) => {
      if (event === "connect") {
        setConnectionState("connected");
      } else if (event === "disconnect") {
        setConnectionState("disconnected");
      } else if (event === "reconnect_attempt") {
        setConnectionState("connecting");
      } else if (event === "connect_error" || event === "reconnect_failed") {
        setConnectionState("disconnected");
      }
    });

    return cleanup;
  }, []);

  return {
    connectionState,
    setConnectionState,
    socketRef,
    ensureSocket,
    waitForConnection: waitForSocketConnection,
    handlersRegisteredRef,
  };
}

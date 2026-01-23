/**
 * Singleton Socket Manager
 * Maintains a single socket instance across all components and navigation.
 * This prevents "WebSocket is closed before connection established" errors
 * caused by component mount/unmount cycles in React Strict Mode.
 */
import { io } from "socket.io-client";

let socket = null;
const listeners = new Set();
const CONNECTION_TIMEOUT = 15000; // 15 seconds

/**
 * Get the socket server URL
 */
function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_SERVER ||
    window.location.origin.replace(/:\d+$/, ":8081")
  );
}

/**
 * Get or create the singleton socket instance.
 * Returns the socket immediately (may not be connected yet).
 */
export function getSocket() {
  if (!socket) {
    const url = getSocketUrl();
    console.log("[SocketManager] Creating singleton socket to:", url);

    socket = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Log connection events
    socket.on("connect", () => {
      console.log("[SocketManager] Connected:", socket.id);
      notifyListeners("connect", socket);
    });

    socket.on("connect_error", (error) => {
      console.error("[SocketManager] Connection error:", error.message);
      notifyListeners("connect_error", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("[SocketManager] Disconnected:", reason);
      notifyListeners("disconnect", reason);
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      console.log("[SocketManager] Reconnect attempt:", attempt);
      notifyListeners("reconnect_attempt", attempt);
    });

    socket.io.on("reconnect", () => {
      console.log("[SocketManager] Reconnected");
      notifyListeners("reconnect", socket);
    });

    socket.io.on("reconnect_failed", () => {
      console.log("[SocketManager] Reconnect failed");
      notifyListeners("reconnect_failed", null);
    });
  }

  return socket;
}

/**
 * Wait for the socket to be connected.
 * Returns immediately if already connected.
 * Rejects on timeout or connection failures.
 * @param {number} timeout - Connection timeout in ms (default: 15000)
 * @returns {Promise<Socket>}
 */
export async function waitForConnection(timeout = CONNECTION_TIMEOUT) {
  const s = getSocket();
  if (s.connected) {
    return s;
  }

  // Create a fresh promise for each attempt
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout"));
    }, timeout);

    const onConnect = () => {
      cleanup();
      resolve(s);
    };

    const onConnectError = (error) => {
      cleanup();
      reject(new Error(`Connection error: ${error.message}`));
    };

    const onReconnectFailed = () => {
      cleanup();
      reject(new Error("Reconnection failed"));
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      s.off("connect", onConnect);
      s.off("connect_error", onConnectError);
      s.io.off("reconnect_failed", onReconnectFailed);
    };

    s.once("connect", onConnect);
    s.once("connect_error", onConnectError);
    s.io.once("reconnect_failed", onReconnectFailed);
  });
}

/**
 * Check if socket is currently connected
 */
export function isConnected() {
  return socket?.connected ?? false;
}

/**
 * Get current socket ID (or null if not connected)
 */
export function getSocketId() {
  return socket?.id ?? null;
}

/**
 * Add a listener for socket manager events
 * @param {Function} callback - Called with (eventName, data)
 * @returns {Function} Unsubscribe function
 */
export function addListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Notify all listeners of an event
 */
function notifyListeners(event, data) {
  listeners.forEach((cb) => {
    try {
      cb(event, data);
    } catch (e) {
      console.error("[SocketManager] Listener error:", e);
    }
  });
}

/**
 * Disconnect the socket (for app-level cleanup only)
 * This should NOT be called by individual components.
 */
export function disconnectSocket() {
  if (socket) {
    console.log("[SocketManager] Disconnecting socket");
    socket.disconnect();
    socket = null;
  }
}

/**
 * Force reconnect (useful after network issues)
 */
export function reconnect() {
  if (socket && !socket.connected) {
    console.log("[SocketManager] Forcing reconnect");
    socket.connect();
  }
}

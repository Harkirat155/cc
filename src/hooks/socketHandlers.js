/**
 * Socket Event Handlers
 * Single Responsibility: Handle socket events and update state
 * Dependency Inversion: Depends on abstractions (setState functions) not concrete implementations
 */

import { setPersistedRoom } from "../utils/clientId";

/**
 * Create game event handlers
 * @param {Object} stateSetters - Object containing state setter functions
 * @returns {Object} Event handler functions
 */
export function createGameEventHandlers(stateSetters) {
  const {
    setRoomId,
    setGameState,
    setRoster,
    setVoiceRoster,
    setNewGameRequester,
    setNewGameRequestedAt,
    setShowModal,
  } = stateSetters;

  return {
    handleGameUpdate: (payload) => {
      console.log("[Socket] gameUpdate received");
      const effectiveRoomId = payload.roomId;
      if (effectiveRoomId) setPersistedRoom(effectiveRoomId);
      setRoomId(effectiveRoomId);
      setGameState((prev) => ({ ...prev, ...payload }));
      if (payload.roster) setRoster(payload.roster);
      if (payload.voiceRoster) setVoiceRoster(payload.voiceRoster || {});

      if (payload.newGameRequester !== undefined) {
        setNewGameRequester(payload.newGameRequester);
        if (payload.newGameRequester) {
          setNewGameRequestedAt(payload.newGameRequestedAt || Date.now());
        } else {
          setNewGameRequestedAt(null);
        }
      } else if (payload.winner) {
        setNewGameRequester(null);
        setNewGameRequestedAt(null);
      }
    },

    handleGameReset: () => {
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
      setShowModal(false);
    },
  };
}

/**
 * Create lobby event handlers
 * @param {Object} stateSetters - Object containing state setter functions
 * @returns {Object} Event handler functions
 */
export function createLobbyEventHandlers(stateSetters) {
  const {
    setLobbyQueue,
    setIsInLobby,
    setLobbyError,
    setRoomId,
    setPlayer,
    setMessage,
  } = stateSetters;

  return {
    handleLobbyUpdate: ({ queue }) => {
      console.log("[Socket] lobbyUpdate received, queue size:", queue?.length);
      setLobbyQueue(queue || []);
    },

    handleMatchFound: ({ roomId: matchedRoomId, player: assignedPlayer, opponent }) => {
      console.log("[Socket] matchFound:", matchedRoomId, assignedPlayer);
      setIsInLobby(false);
      setLobbyError(null);
      setRoomId(matchedRoomId);
      setPlayer(assignedPlayer);
      setPersistedRoom(matchedRoomId);
      setMessage(`Matched with ${opponent}! You are ${assignedPlayer}`);
    },

    handleStartGame: (setMessage) => () => setMessage("Game started"),
  };
}

/**
 * Create connection state handlers
 * @param {Object} stateSetters - Object containing state setter functions
 * @returns {Function} Connection event handler
 */
export function createConnectionHandler(stateSetters) {
  const { setConnectionState, setMessage } = stateSetters;

  return (event) => {
    if (event === "connect") {
      setConnectionState("connected");
      setMessage("Connected");
    } else if (event === "disconnect") {
      setConnectionState("disconnected");
      setMessage("Disconnected");
    } else if (event === "reconnect_attempt") {
      setConnectionState("connecting");
    } else if (event === "connect_error" || event === "reconnect_failed") {
      setConnectionState("disconnected");
    }
  };
}

/**
 * Register all socket event handlers
 * Single Responsibility: Register handlers on a socket
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Object} handlers - Object containing event handler functions
 * @param {Function} addListener - Function to add connection state listener
 * @returns {Function} Cleanup function to unregister handlers
 */
export function registerSocketHandlers(socket, handlers, addListener) {
  const {
    handleGameUpdate,
    handleGameReset,
    handleLobbyUpdate,
    handleMatchFound,
    handleStartGame,
    handleConnection,
  } = handlers;

  // Register event listeners
  socket.on("gameUpdate", handleGameUpdate);
  socket.on("gameReset", handleGameReset);
  socket.on("lobbyUpdate", handleLobbyUpdate);
  socket.on("matchFound", handleMatchFound);
  socket.on("startGame", handleStartGame);

  // Subscribe to connection state changes
  const unsubscribe = addListener(handleConnection);

  // Update initial connection state
  if (socket.connected && handlers.onInitialConnect) {
    handlers.onInitialConnect();
  }

  // Return cleanup function
  return () => {
    socket.off("gameUpdate", handleGameUpdate);
    socket.off("gameReset", handleGameReset);
    socket.off("lobbyUpdate", handleLobbyUpdate);
    socket.off("matchFound", handleMatchFound);
    socket.off("startGame", handleStartGame);
    unsubscribe();
  };
}

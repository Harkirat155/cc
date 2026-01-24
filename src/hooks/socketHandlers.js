/**
 * Socket Event Handlers
 * Single Responsibility: Handle socket events and update state
 * Dependency Inversion: Depends on abstractions (setState functions) not concrete implementations
 */

import { setPersistedRoom } from "../utils/clientId";

const emptyBoard = () => Array(9).fill("");

/**
 * Create game event handlers
 * @param {Object} stateSetters - Object containing state setter functions
 * @param {Object} refs - Object containing refs for callbacks that may change
 * @returns {Object} Event handler functions
 */
export function createGameEventHandlers(stateSetters, refs = {}) {
  const {
    setRoomId,
    setGameState,
    setRoster,
    setVoiceRoster,
    setNewGameRequester,
    setNewGameRequestedAt,
    setShowModal,
  } = stateSetters;

  const { recordMoveRef } = refs;

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

      // Record move in history (using ref to get latest recordMove function)
      if (recordMoveRef?.current) {
        const resultText = payload.winner
          ? payload.winner === "draw"
            ? "Draw"
            : `${payload.winner} wins`
          : `${payload.turn}'s turn`;
        const boardSnapshot = Array.isArray(payload.board) ? payload.board.slice() : emptyBoard();
        const entryType = payload.winner
          ? payload.winner === "draw"
            ? "draw"
            : "win"
          : "move";
        recordMoveRef.current(boardSnapshot, resultText, entryType);
      }

      // Show modal on game end
      if (payload.winner) {
        setShowModal(true);
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

    handleMatchError: ({ error }) => {
      console.log("[Socket] matchError:", error);
      setIsInLobby(false);
      setLobbyError(error);
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
    handleMatchError,
    handleStartGame,
    handleConnection,
  } = handlers;

  // Register event listeners
  socket.on("gameUpdate", handleGameUpdate);
  socket.on("gameReset", handleGameReset);
  socket.on("lobbyUpdate", handleLobbyUpdate);
  socket.on("matchFound", handleMatchFound);
  socket.on("matchError", handleMatchError);
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
    socket.off("matchError", handleMatchError);
    socket.off("startGame", handleStartGame);
    unsubscribe();
  };
}

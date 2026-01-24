/**
 * useSocketGame - Main game state hook
 * Refactored to follow SOLID principles:
 * - Single Responsibility: Orchestrates game logic, delegates specific concerns to specialized hooks
 * - Open/Closed: Extensible through composition of hooks
 * - Dependency Inversion: Depends on abstractions (hooks) not concrete implementations
 */

import { useCallback, useRef, useState } from "react";
import { getClientId } from "../utils/clientId";
import useDisplayName from "./useDisplayName";
import useGameHistory from "./useGameHistory";
import { useSocketConnection } from "./useSocketConnection";
import { useSocketLobby } from "./useSocketLobby";
import { useSocketRoom } from "./useSocketRoom";
import { useGameOperations } from "./useGameOperations";
import {
  getSocket,
  waitForConnection,
  isConnected,
  getSocketId,
  addListener,
} from "../utils/socketManager";
import {
  createGameEventHandlers,
  createLobbyEventHandlers,
  createConnectionHandler,
  registerSocketHandlers,
} from "./socketHandlers";

// Local game state
const emptyBoard = () => Array(9).fill("");
const initialLocalState = {
  board: emptyBoard(),
  turn: "X",
  winner: null,
  winningLine: [],
  xScore: 0,
  oScore: 0,
};

/**
 * Main game hook - orchestrates all game-related functionality
 * Follows Dependency Inversion: Uses abstractions (other hooks) instead of concrete implementations
 */
export default function useSocketGame() {
  // Core game state
  const [gameState, setGameState] = useState(initialLocalState);
  const [showModal, setShowModal] = useState(false);
  const [newGameRequester, setNewGameRequester] = useState(null);
  const [newGameRequestedAt, setNewGameRequestedAt] = useState(null);
  const [connectionState, setConnectionState] = useState(isConnected() ? "connected" : "disconnected");

  // Refs
  const handlersRegisteredRef = useRef(false);
  const clientIdRef = useRef(getClientId());
  const socketRef = useRef(null);

  // Use specialized hooks (Dependency Inversion)
  const { displayName, updateDisplayName: baseUpdateDisplayName } = useDisplayName();
  const {
    moveHistory,
    completedGames,
    viewIndex,
    displayedBoard,
    recordMove,
    finalizeCurrentGame,
    resetHistory,
    jumpTo,
    resumeLatest,
  } = useGameHistory();

  // Socket initialization helper
  const ensureSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
      // Reset flag in case this is a new socket instance
      handlersRegisteredRef.current = false;
      registerAllHandlers(socketRef.current);
    }
    return socketRef.current;
  }, []);

  // Lobby operations (Single Responsibility)
  const lobby = useSocketLobby({ ensureSocket, waitForConnection });

  // Room operations (Single Responsibility)
  const room = useSocketRoom({
    ensureSocket,
    waitForConnection,
    clientIdRef,
    finalizeCurrentGame,
    resetHistory,
  });

  // Game operations (Single Responsibility)
  const gameOps = useGameOperations({
    gameState,
    setGameState,
    initialLocalState,
    socketRef,
    roomId: room.roomId,
    isMultiplayer: room.isMultiplayer,
    recordMove,
    resumeLatest,
    finalizeCurrentGame,
    resetHistory,
    setShowModal,
    setNewGameRequester,
  });

  // Register socket event handlers
  const registerAllHandlers = useCallback((socket) => {
    if (handlersRegisteredRef.current) return;
    handlersRegisteredRef.current = true;

    // Create handler functions (Dependency Inversion - inject state setters)
    const gameHandlers = createGameEventHandlers({
      setRoomId: room.setRoomId,
      setGameState,
      setRoster: room.setRoster,
      setVoiceRoster: room.setVoiceRoster,
      setNewGameRequester,
      setNewGameRequestedAt,
      setShowModal,
    });

    const lobbyHandlers = createLobbyEventHandlers({
      setLobbyQueue: lobby.setLobbyQueue,
      setIsInLobby: lobby.setIsInLobby,
      setLobbyError: lobby.setLobbyError,
      setRoomId: room.setRoomId,
      setPlayer: room.setPlayer,
      setMessage: room.setMessage,
    });

    const connectionHandler = createConnectionHandler({
      setConnectionState,
      setMessage: room.setMessage,
    });

    const handlers = {
      ...gameHandlers,
      ...lobbyHandlers,
      handleStartGame: lobbyHandlers.handleStartGame(room.setMessage),
      handleConnection: connectionHandler,
      onInitialConnect: () => {
        if (socket.connected) {
          setConnectionState("connected");
        }
      },
    };

    // Register handlers
    const cleanup = registerSocketHandlers(socket, handlers, addListener);

    return cleanup;
  }, [lobby, room]);

  // Display name update with server notification
  const updateDisplayName = useCallback(
    (newName) => {
      return baseUpdateDisplayName(newName, {
        onServerNotify: (trimmed) => {
          if (socketRef.current?.connected && room.roomId) {
            socketRef.current.emit("updateDisplayName", { roomId: room.roomId, displayName: trimmed });
          }
        },
      });
    },
    [baseUpdateDisplayName, room.roomId]
  );

  // Return consolidated interface (Interface Segregation - only expose what's needed)
  return {
    // Game state
    gameState,
    history: moveHistory,
    completedGames,
    viewIndex,
    displayedBoard,
    showModal,
    setShowModal,
    newGameRequester,
    newGameRequestedAt,

    // Room state
    ...room,

    // Lobby state
    ...lobby,

    // Connection state
    connectionState,
    socketId: getSocketId(),
    socket: socketRef.current,

    // Game operations
    handleSquareClick: gameOps.handleSquareClick,
    resetGame: gameOps.resetGame,
    resetScores: gameOps.resetScores,
    requestNewGame: gameOps.requestNewGame,
    cancelNewGameRequest: gameOps.cancelNewGameRequest,

    // History operations
    jumpTo,
    resumeLatest,

    // Display name
    displayName,
    updateDisplayName,
  };
}

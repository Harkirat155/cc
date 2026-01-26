import { useCallback, useEffect, useRef, useState } from "react";
import { getDisplayName } from "../utils/randomName";
import { getClientId, setPersistedRoom } from "../utils/clientId";
import useDisplayName from "./useDisplayName";
import useGameHistory from "./useGameHistory";
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
import { getModeConfig, getPersistedMode, setPersistedMode, createEmptyBoard, DEFAULT_MODE } from "../utils/gameMode";
import { calcWinnerWithMode } from "../utils/winCheck";

// Local game helpers with mode support
function calcWinner(board, modeId = DEFAULT_MODE) {
  const { size, streak } = getModeConfig(modeId);
  return calcWinnerWithMode(board, size, streak);
}

const createInitialLocalState = (modeId = DEFAULT_MODE) => ({
  board: createEmptyBoard(modeId),
  turn: "X",
  winner: null,
  winningLine: [],
  xScore: 0,
  oScore: 0,
  gameMode: modeId,
});

export default function useSocketGame() {
  const [gameMode, setGameMode] = useState(() => getPersistedMode());
  const [gameState, setGameState] = useState(() => createInitialLocalState(gameMode));
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [roster, setRoster] = useState({ X: null, O: null, spectators: [] });
  const [voiceRoster, setVoiceRoster] = useState({});
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [message, setMessage] = useState("Local game ready");
  const [showModal, setShowModal] = useState(false);
  const [newGameRequester, setNewGameRequester] = useState(null);
  const [newGameRequestedAt, setNewGameRequestedAt] = useState(null);
  const [connectionState, setConnectionState] = useState(isConnected() ? "connected" : "disconnected");
  const [modeChangeRequest, setModeChangeRequest] = useState(null);

  // Lobby state (inlined to avoid closure issues)
  const [lobbyQueue, setLobbyQueue] = useState([]);
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  // Track if event handlers are registered to avoid duplicates
  const handlersRegisteredRef = useRef(false);
  const clientIdRef = useRef(getClientId());
  const socketRef = useRef(null); // Lazy socket reference
  const recordMoveRef = useRef(null); // Ref to latest recordMove function
  const resetHistoryRef = useRef(null); // Ref to latest resetHistory function

  // Use extracted hooks
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

  // Keep recordMoveRef updated with latest function
  useEffect(() => {
    recordMoveRef.current = recordMove;
  }, [recordMove]);

  // Keep resetHistoryRef updated with latest function
  useEffect(() => {
    resetHistoryRef.current = resetHistory;
  }, [resetHistory]);

  const isMultiplayer = !!roomId;

  // Register socket event handlers (using extracted handler creators - Dependency Inversion)
  const registerHandlers = useCallback((socket) => {
    if (handlersRegisteredRef.current) return;
    handlersRegisteredRef.current = true;

    // Create handlers using extracted functions (Single Responsibility)
    const gameHandlers = createGameEventHandlers({
      setRoomId,
      setGameState,
      setRoster,
      setVoiceRoster,
      setNewGameRequester,
      setNewGameRequestedAt,
      setShowModal,
      setModeChangeRequest,
      setGameMode,
    }, { recordMoveRef, resetHistoryRef });

    const lobbyHandlers = createLobbyEventHandlers({
      setLobbyQueue,
      setIsInLobby,
      setLobbyError,
      setRoomId,
      setPlayer,
      setMessage,
    });

    const connectionHandler = createConnectionHandler({
      setConnectionState,
      setMessage,
    });

    // Register all handlers
    const handlers = {
      ...gameHandlers,
      ...lobbyHandlers,
      handleStartGame: () => setMessage("Game started"),
      handleConnection: connectionHandler,
      onInitialConnect: () => socket.connected && setConnectionState("connected"),
    };

    const cleanup = registerSocketHandlers(socket, handlers, addListener);
    return cleanup;
  }, []);

  // Lazy socket getter - only creates socket when needed for multiplayer
  const ensureSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
      // Reset flag in case this is a new socket instance
      handlersRegisteredRef.current = false;
      registerHandlers(socketRef.current);
    }
    return socketRef.current;
  }, [registerHandlers]);

  // Join lobby - uses singleton socket, properly waits for connection
  const joinLobby = useCallback(async (displayNameArg) => {
    setLobbyError(null);
    setConnectionState("connecting");

    try {
      // Ensure socket exists and wait for connection
      ensureSocket();
      const socket = await waitForConnection();
      
      console.log("[Lobby] Socket connected, emitting joinLobby with name:", displayNameArg, "mode:", gameMode);
      
      return new Promise((resolve, reject) => {
        socket.emit("joinLobby", { displayName: displayNameArg, gameMode }, (response) => {
          console.log("[Lobby] joinLobby response:", response);
          if (response?.success) {
            setIsInLobby(true);
            if (response.gameMode) {
              setGameMode(response.gameMode);
            }
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
      setConnectionState("disconnected");
      setLobbyError("Connection failed");
      throw err;
    }
  }, [ensureSocket, gameMode]);

  // Leave lobby
  const leaveLobby = useCallback(() => {
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


  // Change game mode (local: immediate, multiplayer: request-based)
  const changeGameMode = useCallback((newMode) => {
    if (!isMultiplayer) {
      // Local mode: apply immediately
      setPersistedMode(newMode);
      setGameMode(newMode);
      setGameState(createInitialLocalState(newMode));
      resetHistory("Mode changed • X to move", "system", newMode);
    } else if (socketRef.current?.connected && roomId) {
      // Multiplayer mode: send request for other player to approve
      socketRef.current.emit("requestModeChange", { roomId, newMode }, (response) => {
        if (!response?.success) {
          console.error("[ModeChange] Request failed:", response?.error);
        }
      });
    }
  }, [isMultiplayer, roomId, resetHistory]);

  // Accept a mode change request from another player
  const acceptModeChange = useCallback(() => {
    if (!isMultiplayer || !socketRef.current?.connected || !roomId) return;
    socketRef.current.emit("acceptModeChange", { roomId }, (response) => {
      if (!response?.success) {
        console.error("[ModeChange] Accept failed:", response?.error);
      }
    });
  }, [isMultiplayer, roomId]);

  // Reject a mode change request from another player
  const rejectModeChange = useCallback(() => {
    if (!isMultiplayer || !socketRef.current?.connected || !roomId) return;
    socketRef.current.emit("rejectModeChange", { roomId }, (response) => {
      if (!response?.success) {
        console.error("[ModeChange] Reject failed:", response?.error);
      }
    });
  }, [isMultiplayer, roomId]);

  // Cancel your own mode change request
  const cancelModeChangeRequest = useCallback(() => {
    if (!isMultiplayer || !socketRef.current?.connected || !roomId) return;
    socketRef.current.emit("cancelModeChangeRequest", { roomId }, (response) => {
      if (!response?.success) {
        console.error("[ModeChange] Cancel failed:", response?.error);
      }
    });
    setModeChangeRequest(null);
  }, [isMultiplayer, roomId]);

  const createRoom = useCallback(async () => {
    const currentDisplayName = getDisplayName();
    
    try {
      ensureSocket();
      const socket = await waitForConnection();
      socket.emit("createRoom", { clientId: clientIdRef.current, displayName: currentDisplayName, gameMode }, (resp) => {
        if (resp?.error) {
          setMessage(resp.error);
          return;
        }
        setRoomId(resp.roomId);
        setPlayer(resp.player);
        setIsRoomCreator(true);
        setMessage(`Room ${resp.roomId} created. Waiting for opponent...`);
        setPersistedRoom(resp.roomId);
        if (resp.gameMode) {
          setGameMode(resp.gameMode);
        }
      });
    } catch (err) {
      console.error("[Room] Failed to create room:", err);
      setMessage("Connection failed");
    }
  }, [ensureSocket, gameMode]);

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
  }, [ensureSocket]);

  const handleSquareClick = useCallback(
    (index) => {
      // Auto-resume to latest if viewing past
      resumeLatest();

      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current || !socketRef.current.connected) return;
        const socket = socketRef.current;
        if (gameState.winner) return;
        if (gameState.turn !== player) return;
        if (gameState.board[index] !== "") return;
        socket.emit("makeMove", { roomId, index });
        return;
      }

      // Local fallback with mode support
      const currentMode = gameState.gameMode || gameMode;
      
      setGameState((current) => {
        if (current.winner || current.board[index] !== "") return current;
        const newBoard = [...current.board];
        newBoard[index] = current.turn;
        const result = calcWinner(newBoard, currentMode);
        const newTurn = current.turn === "X" ? "O" : "X";

        const newState = {
          ...current,
          board: newBoard,
          turn: result ? current.turn : newTurn,
          winner: result?.winner || null,
          winningLine: result?.line || [],
          xScore: result?.winner === "X" ? current.xScore + 1 : current.xScore,
          oScore: result?.winner === "O" ? current.oScore + 1 : current.oScore,
        };

        const resultText = result
          ? result.winner === "draw"
            ? "Draw"
            : `${result.winner} wins`
          : `${newTurn}'s turn`;
        const entryType = result ? (result.winner === "draw" ? "draw" : "win") : "move";
        recordMove(newBoard.slice(), resultText, entryType);

        if (result) setShowModal(true);
        return newState;
      });
    },
    [isMultiplayer, player, roomId, gameState.turn, gameState.winner, gameState.board, gameState.gameMode, gameMode, recordMove, resumeLatest]
  );

  const resetGame = useCallback(() => {
    finalizeCurrentGame(gameState.winner);
    const currentMode = gameState.gameMode || gameMode;

    if (isMultiplayer && socketRef.current?.connected) {
      socketRef.current.emit("resetGame", { roomId });
    } else {
      setGameState((prev) => ({
        ...createInitialLocalState(currentMode),
        xScore: prev.xScore,
        oScore: prev.oScore,
      }));
    }

    resetHistory("New game • X to move", "reset", currentMode);
    setShowModal(false);
    setNewGameRequester(null);
  }, [finalizeCurrentGame, gameState.winner, gameState.gameMode, gameMode, isMultiplayer, roomId, resetHistory]);

  const resetScores = useCallback(() => {
    const currentMode = gameState.gameMode || gameMode;
    
    if (isMultiplayer && socketRef.current?.connected) {
      // In multiplayer, only emit to server - don't reset local state
      // Server will broadcast gameUpdate with zeroed scores
      socketRef.current.emit("resetScores", { roomId });
    } else {
      // Local game: reset everything
      setGameState(() => ({ ...createInitialLocalState(currentMode) }));
      resetHistory("Scores reset • X to move", "system", currentMode);
    }
    setShowModal(false);
    setNewGameRequester(null);
  }, [isMultiplayer, roomId, gameState.gameMode, gameMode, resetHistory]);

  const leaveRoom = useCallback(() => {
    return new Promise((resolve) => {
      if (!isMultiplayer) {
        resolve();
        return;
      }

      finalizeCurrentGame(gameState.winner);

      if (socketRef.current?.connected) {
        socketRef.current.emit("leaveRoom", { roomId, clientId: clientIdRef.current });
      }

      setRoomId(null);
      setPlayer(null);
      setIsRoomCreator(false);
      setRoster({ X: null, O: null, spectators: [] });
      setGameState(createInitialLocalState(gameMode));
      setMessage("Left room");
      setPersistedRoom(null);
      resetHistory("Left room", "system", gameMode);
      setShowModal(false);
      setNewGameRequester(null);
      resolve();
    });
  }, [isMultiplayer, roomId, finalizeCurrentGame, gameState.winner, gameMode, resetHistory]);

  // Display name update with server notification
  const updateDisplayName = useCallback(
    (newName) => {
      return baseUpdateDisplayName(newName, {
        onServerNotify: (trimmed) => {
          if (socketRef.current?.connected && roomId) {
            socketRef.current.emit("updateDisplayName", { roomId, displayName: trimmed });
          }
        },
      });
    },
    [baseUpdateDisplayName, roomId]
  );

  return {
    gameState,
    history: moveHistory,
    completedGames,
    viewIndex,
    displayedBoard,
    message,
    roomId,
    player,
    roster,
    voiceRoster,
    isMultiplayer,
    isRoomCreator,
    showModal,
    setShowModal,
    newGameRequester,
    requestNewGame: () => {
      if (!isMultiplayer || !socketRef.current?.connected) return;
      setNewGameRequester(socketRef.current.id);
      setNewGameRequestedAt(Date.now());
      socketRef.current.emit("requestNewGame", { roomId });
    },
    cancelNewGameRequest: () => {
      if (!isMultiplayer || !socketRef.current?.connected) return;
      socketRef.current.emit("cancelNewGameRequest", { roomId });
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
    },
    socketId: getSocketId(),
    socket: socketRef.current,
    newGameRequestedAt,
    createRoom,
    joinRoom,
    handleSquareClick,
    resetGame,
    resetScores,
    leaveRoom,
    jumpTo,
    resumeLatest,
    // Connection state
    connectionState,
    // Lobby methods
    lobbyQueue,
    isInLobby,
    lobbyError,
    joinLobby,
    leaveLobby,
    // Display name
    displayName,
    updateDisplayName,
    // Game mode
    gameMode,
    changeGameMode,
    // Mode change request (multiplayer)
    modeChangeRequest,
    acceptModeChange,
    rejectModeChange,
    cancelModeChangeRequest,
  };
}

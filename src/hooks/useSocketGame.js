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

// Local game helpers (fallback when not in a multiplayer room)
const emptyBoard = () => Array(9).fill("");
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function calcWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a, b, c] };
  }
  if (board.every((c) => c !== "")) return { winner: "draw", line: [] };
  return null;
}

const initialLocalState = {
  board: emptyBoard(),
  turn: "X",
  winner: null,
  winningLine: [],
  xScore: 0,
  oScore: 0,
};

export default function useSocketGame() {
  const [gameState, setGameState] = useState(initialLocalState);
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

  // Lobby state (inlined to avoid closure issues)
  const [lobbyQueue, setLobbyQueue] = useState([]);
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  // Track if event handlers are registered to avoid duplicates
  const handlersRegisteredRef = useRef(false);
  const clientIdRef = useRef(getClientId());
  const socketRef = useRef(null); // Lazy socket reference

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

  const isMultiplayer = !!roomId;

  // Lazy socket getter - only creates socket when needed for multiplayer
  const ensureSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = getSocket();
    }
    return socketRef.current;
  }, []);

  // Set up socket event handlers only when socket is created
  useEffect(() => {
    if (handlersRegisteredRef.current || !socketRef.current) return;
    handlersRegisteredRef.current = true;

    const socket = socketRef.current;

    // Game events
    const handleGameUpdate = (payload) => {
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
    };

    const handleGameReset = () => {
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
      setShowModal(false);
    };

    const handleLobbyUpdate = ({ queue }) => {
      console.log("[Socket] lobbyUpdate received, queue size:", queue?.length);
      setLobbyQueue(queue || []);
    };

    const handleMatchFound = ({ roomId: matchedRoomId, player: assignedPlayer, opponent }) => {
      console.log("[Socket] matchFound:", matchedRoomId, assignedPlayer);
      setIsInLobby(false);
      setLobbyError(null);
      setRoomId(matchedRoomId);
      setPlayer(assignedPlayer);
      setPersistedRoom(matchedRoomId);
      setMessage(`Matched with ${opponent}! You are ${assignedPlayer}`);
    };

    const handleStartGame = () => setMessage("Game started");

    socket.on("gameUpdate", handleGameUpdate);
    socket.on("gameReset", handleGameReset);
    socket.on("lobbyUpdate", handleLobbyUpdate);
    socket.on("matchFound", handleMatchFound);
    socket.on("startGame", handleStartGame);

    // Subscribe to socket manager events for connection state
    const unsubscribe = addListener((event) => {
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
    });

    // Update initial connection state
    if (socket.connected) {
      setConnectionState("connected");
    }

    return () => {
      // Clean up event handlers when component unmounts
      if (!socketRef.current) return;
      const socket = socketRef.current;
      socket.off("gameUpdate", handleGameUpdate);
      socket.off("gameReset", handleGameReset);
      socket.off("lobbyUpdate", handleLobbyUpdate);
      socket.off("matchFound", handleMatchFound);
      socket.off("startGame", handleStartGame);
      unsubscribe();
      handlersRegisteredRef.current = false;
    };
  }, []);

  // Track gameUpdate for history recording (separate effect to handle recordMove dependency)
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    const handleGameUpdateForHistory = (payload) => {
      // Record move in history
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

      recordMove(boardSnapshot, resultText, entryType);
      if (payload.winner) setShowModal(true);
    };

    socket.on("gameUpdate", handleGameUpdateForHistory);

    return () => {
      socket.off("gameUpdate", handleGameUpdateForHistory);
    };
  }, [recordMove]);

  // Join lobby - uses singleton socket, properly waits for connection
  const joinLobby = useCallback(async (displayNameArg) => {
    setLobbyError(null);
    setConnectionState("connecting");

    try {
      // Ensure socket exists and wait for connection
      ensureSocket();
      const socket = await waitForConnection();
      
      // Update connection state after successful connection
      setConnectionState("connected");
      
      console.log("[Lobby] Socket connected, emitting joinLobby with name:", displayNameArg);
      
      return new Promise((resolve, reject) => {
        socket.emit("joinLobby", { displayName: displayNameArg }, (response) => {
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
      setConnectionState("disconnected");
      setLobbyError("Connection failed");
      throw err;
    }
  }, [ensureSocket]);

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
  }, [ensureSocket]);

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

      // Local fallback
      setGameState((current) => {
        if (current.winner || current.board[index] !== "") return current;
        const newBoard = [...current.board];
        newBoard[index] = current.turn;
        const result = calcWinner(newBoard);
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
    [isMultiplayer, player, roomId, gameState.turn, gameState.winner, gameState.board, recordMove, resumeLatest]
  );

  const resetGame = useCallback(() => {
    finalizeCurrentGame(gameState.winner);

    if (isMultiplayer && socketRef.current?.connected) {
      socketRef.current.emit("resetGame", { roomId });
    } else {
      setGameState((prev) => ({
        ...initialLocalState,
        xScore: prev.xScore,
        oScore: prev.oScore,
      }));
    }

    resetHistory("New game • X to move", "reset");
    setShowModal(false);
    setNewGameRequester(null);
  }, [finalizeCurrentGame, gameState.winner, isMultiplayer, roomId, resetHistory]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current?.connected) {
      // In multiplayer, only emit to server - don't reset local state
      // Server will broadcast gameUpdate with zeroed scores
      socketRef.current.emit("resetScores", { roomId });
    } else {
      // Local game: reset everything
      setGameState(() => ({ ...initialLocalState }));
      resetHistory("Scores reset • X to move", "system");
    }
    setShowModal(false);
    setNewGameRequester(null);
  }, [isMultiplayer, roomId, resetHistory]);

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
      setGameState(initialLocalState);
      setMessage("Left room");
      setPersistedRoom(null);
      resetHistory("Left room", "system");
      setShowModal(false);
      setNewGameRequester(null);
      resolve();
    });
  }, [isMultiplayer, roomId, finalizeCurrentGame, gameState.winner, resetHistory]);

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
  };
}

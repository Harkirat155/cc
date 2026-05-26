import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import "@shared/games/index.js"; // register built-in games on import
import { get as getGameRules } from "@shared/games/registry.js";
import { markToSlot } from "@shared/games/ttt.js";

// Local fallback uses the SAME rules engine the server uses. No duplicate
// LINES/calcWinner here — that drift bug is gone. The UI still consumes the
// legacy 'X'/'O' wire shape, so we translate at the boundary (mirrors
// server/roomPublisher.js toLegacyWireState).
const DEFAULT_GAME_ID = "ttt";

function resolveKnownGameId(gameId, fallback = DEFAULT_GAME_ID) {
  if (!gameId || typeof gameId !== "string") return fallback;
  const normalized = gameId.trim().toLowerCase();
  try {
    getGameRules(normalized);
    return normalized;
  } catch {
    return fallback;
  }
}

function getGameDisplayName(gameId) {
  try {
    return getGameRules(gameId).displayName || gameId;
  } catch {
    return gameId || "game";
  }
}

function createInitialBoardForGame(gameId) {
  const resolvedGameId = resolveKnownGameId(gameId);
  return getGameRules(resolvedGameId).createInitialState().board.slice();
}

// Read ?game= from the URL so the local-mode initial state is built against
// the requested rules.
function resolveLocalGameId() {
  if (typeof window === "undefined") return DEFAULT_GAME_ID;
  try {
    const params = new window.URLSearchParams(window.location.search);
    const requested = params.get("game");
    return resolveKnownGameId(requested);
  } catch {
    return DEFAULT_GAME_ID;
  }
}

function toLegacyLocalShape(state, gameId = DEFAULT_GAME_ID) {
  const rules = getGameRules(gameId);
  const marks = rules.playerInfo.map((p) => p.label);
  const turnMark = marks[state.turn] ?? marks[0];
  let winner = null;
  if (state.status === "draw") winner = "draw";
  else if (state.status === "win") winner = marks[state.winner] ?? null;
  const scores = state.scores || [0, 0];
  return {
    board: state.board,
    turn: turnMark,
    winner,
    winningLine: state.winningCells || [],
    xScore: scores[0] || 0,
    oScore: scores[1] || 0,
    // Slot-indexed + presentation fields mirror what the server publisher
    // emits in multiplayer; surfacing them in local mode too keeps the UI
    // game-agnostic.
    turnSlot: Number.isInteger(state.turn) ? state.turn : null,
    winnerSlot: state.status === "win" ? state.winner : (state.status === "draw" ? "draw" : null),
    scores: [scores[0] || 0, scores[1] || 0],
    status: state.status || "active",
    winningCells: state.winningCells || [],
    playerInfo: rules.playerInfo,
    boardSpec: rules.boardSpec,
    moveStyle: rules.moveStyle || "place",
    gameId,
    // Keep internal slot-indexed state riding along for the next move so we
    // don't have to re-parse the wire shape back into rules-land.
    __internal: state,
  };
}

function buildInitialLocalState(gameIdOverride) {
  const gameId = gameIdOverride
    ? resolveKnownGameId(gameIdOverride)
    : resolveLocalGameId();
  return toLegacyLocalShape(getGameRules(gameId).createInitialState(), gameId);
}

export default function useSocketGame() {
  const [gameState, setGameState] = useState(buildInitialLocalState);
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [selection, setSelection] = useState(null);
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
  const recordMoveRef = useRef(null); // Ref to latest recordMove function
  const resetHistoryRef = useRef(null); // Ref to latest resetHistory function
  const gameIdRef = useRef(gameState.gameId || DEFAULT_GAME_ID);

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
  } = useGameHistory(() => buildInitialLocalState().board);

  // Keep recordMoveRef updated with latest function
  useEffect(() => {
    recordMoveRef.current = recordMove;
  }, [recordMove]);

  useEffect(() => {
    resetHistoryRef.current = resetHistory;
  }, [resetHistory]);

  useEffect(() => {
    gameIdRef.current = gameState.gameId || DEFAULT_GAME_ID;
  }, [gameState.gameId]);

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
      setSelection,
    }, { recordMoveRef, resetHistoryRef, gameIdRef });

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
  const joinLobby = useCallback(async (displayNameArg, gameIdArg) => {
    setLobbyError(null);
    setConnectionState("connecting");
    const preferredGameId = resolveKnownGameId(gameIdArg || gameState.gameId);

    try {
      // Ensure socket exists and wait for connection
      ensureSocket();
      const socket = await waitForConnection();

      return new Promise((resolve, reject) => {
        socket.emit("joinLobby", { displayName: displayNameArg, gameId: preferredGameId }, (response) => {
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
  }, [ensureSocket, gameState.gameId]);

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


  const createRoom = useCallback(async (gameId) => {
    const currentDisplayName = getDisplayName();

    try {
      ensureSocket();
      const socket = await waitForConnection();
      const payload = { clientId: clientIdRef.current, displayName: currentDisplayName };
      if (gameId) payload.gameId = gameId;
      socket.emit("createRoom", payload, (resp) => {
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

  // Slot the local user controls. Multiplayer: seat 'X'/'O' → 0/1.
  // Local: whichever slot is on turn.
  const playerSlot = isMultiplayer
    ? (player === "X" ? 0 : player === "O" ? 1 : -1)
    : (Number.isInteger(gameState.turnSlot) ? gameState.turnSlot : 0);

  // Reconstruct an internal-shape state from wire fields so we can call
  // rules.getLegalMoves / applyMove against the broadcast payload.
  const reconstructState = useCallback(() => {
    if (gameState.__internal) return gameState.__internal;
    return {
      board: gameState.board,
      turn: Number.isInteger(gameState.turnSlot) ? gameState.turnSlot : 0,
      status: gameState.status || "active",
      winner: typeof gameState.winnerSlot === "number" ? gameState.winnerSlot : null,
      winningCells: gameState.winningCells || [],
      scores: gameState.scores || [0, 0],
      moveCount: 0,
    };
  }, [gameState]);

  const moveStyle = gameState.moveStyle || "place";
  const legalTargets = useMemo(() => {
    if (moveStyle !== "select-target" || selection === null) return [];
    const gameId = gameState.gameId || DEFAULT_GAME_ID;
    let rules;
    try { rules = getGameRules(gameId); } catch { return []; }
    if (playerSlot < 0) return [];
    return rules.getLegalMoves(reconstructState(), playerSlot, selection) || [];
  }, [moveStyle, selection, playerSlot, gameState.gameId, reconstructState]);

  const handleSquareClick = useCallback(
    (index) => {
      resumeLatest();

      const gameId = gameState.gameId || DEFAULT_GAME_ID;
      let rules;
      try { rules = getGameRules(gameId); } catch { rules = null; }
      const usesSelection = (gameState.moveStyle || "place") === "select-target";

      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current || !socketRef.current.connected) return;
        const socket = socketRef.current;
        if (gameState.winner) return;
        const onTurn = Number.isInteger(gameState.turnSlot)
          ? gameState.turnSlot === playerSlot
          : gameState.turn === player;
        if (!onTurn) return;

        if (usesSelection && rules) {
          const cell = gameState.board[index];
          const ownsCell = cell && typeof cell === "object" && cell.owner === playerSlot;
          if (selection === null) {
            if (ownsCell) setSelection(index);
            return;
          }
          if (ownsCell) { setSelection(index); return; }
          const match = legalTargets.find((m) => m.to === index);
          if (!match) { setSelection(null); return; }
          socket.emit("makeMove", { roomId, move: match });
          setSelection(null);
          return;
        }

        if (rules && typeof rules.moveFromCellClick === "function") {
          const reconstructed = reconstructState();
          const mvMaybe = rules.moveFromCellClick(reconstructed, index, playerSlot);
          if (!mvMaybe) return;
          socket.emit("makeMove", { roomId, move: mvMaybe });
          return;
        }
        if (gameState.board[index] !== "") return;
        socket.emit("makeMove", { roomId, index });
        return;
      }

      // Local select-target flow.
      if (usesSelection && rules) {
        setGameState((current) => {
          if (current.winner) return current;
          const slot = Number.isInteger(current.turnSlot) ? current.turnSlot : 0;
          const cell = current.board[index];
          const ownsCell = cell && typeof cell === "object" && cell.owner === slot;
          if (selection === null) {
            if (ownsCell) setSelection(index);
            return current;
          }
          if (ownsCell) { setSelection(index); return current; }
          const candidates = rules.getLegalMoves(current.__internal, slot, selection) || [];
          const move = candidates.find((m) => m.to === index);
          if (!move) { setSelection(null); return current; }

          let result;
          try { result = rules.applyMove(current.__internal, move, slot); }
          catch { setSelection(null); return current; }

          let nextInternal = result.state;
          if (nextInternal.status === "win") {
            const winnerSlot = nextInternal.winner;
            const newScores = [...(current.__internal.scores || [0, 0])];
            newScores[winnerSlot] = (newScores[winnerSlot] || 0) + 1;
            nextInternal = { ...nextInternal, scores: newScores };
          }
          const newState = toLegacyLocalShape(nextInternal, gameId);
          const resultText = newState.winner
            ? newState.winner === "draw" ? "Draw" : `${newState.winner} wins`
            : `${newState.turn}'s turn`;
          const entryType = newState.winner
            ? newState.winner === "draw" ? "draw" : "win"
            : "move";
          recordMove(newState.board.slice(), resultText, entryType, {
            move, events: result.events, slot,
          });
          if (newState.winner) setShowModal(true);
          setSelection(null);
          return newState;
        });
        return;
      }

      // Local placement path.
      setGameState((current) => {
        if (current.winner) return current;

        const localGameId = current.gameId || DEFAULT_GAME_ID;
        const localRules = getGameRules(localGameId);
        const slot = Number.isInteger(current.turnSlot)
          ? current.turnSlot
          : markToSlot(current.turn);
        const prevInternal = current.__internal;
        const move = typeof localRules.moveFromCellClick === "function"
          ? localRules.moveFromCellClick(prevInternal, index, slot)
          : { type: "place", cell: index };
        if (!move) return current;

        let result;
        try {
          result = localRules.applyMove(prevInternal, move, slot);
        } catch {
          return current;
        }

        let nextInternal = result.state;
        if (nextInternal.status === "win") {
          const winnerSlot = nextInternal.winner;
          const newScores = [...(prevInternal.scores || [0, 0])];
          newScores[winnerSlot] = (newScores[winnerSlot] || 0) + 1;
          nextInternal = { ...nextInternal, scores: newScores };
        }

        const newState = toLegacyLocalShape(nextInternal, localGameId);

        const resultText = newState.winner
          ? newState.winner === "draw"
            ? "Draw"
            : `${newState.winner} wins`
          : `${newState.turn}'s turn`;
        const entryType = newState.winner
          ? newState.winner === "draw"
            ? "draw"
            : "win"
          : "move";
        recordMove(newState.board.slice(), resultText, entryType, {
          move,
          events: result.events,
          slot,
        });

        if (newState.winner) setShowModal(true);
        return newState;
      });
    },
    [isMultiplayer, player, playerSlot, roomId, gameState, selection, legalTargets, reconstructState, recordMove, resumeLatest]
  );

  const resetGame = useCallback(() => {
    finalizeCurrentGame(gameState.winner);
    const freshBoard = createInitialBoardForGame(gameState.gameId || DEFAULT_GAME_ID);

    if (isMultiplayer && socketRef.current?.connected) {
      socketRef.current.emit("resetGame", { roomId });
    } else {
      setGameState((prev) => {
        const localGameId = prev.gameId || DEFAULT_GAME_ID;
        const rules = getGameRules(localGameId);
        const fresh = rules.createInitialState();
        const prevInternal = prev.__internal;
        // Loser starts (same rule the server applies in nextStarterSlot).
        const nextTurn =
          prevInternal?.status === "win" || prevInternal?.status === "draw"
            ? prevInternal.turn === 0 ? 1 : 0
            : 0;
        return toLegacyLocalShape({
          ...fresh,
          turn: nextTurn,
          scores: prevInternal?.scores ? [...prevInternal.scores] : [0, 0],
        }, localGameId);
      });
    }

    resetHistory("New game • X to move", "reset", freshBoard);
    setShowModal(false);
    setNewGameRequester(null);
    setSelection(null);
  }, [finalizeCurrentGame, gameState.gameId, gameState.winner, isMultiplayer, roomId, resetHistory]);

  const switchGame = useCallback((gameId) => {
    const nextGameId = resolveKnownGameId(gameId, null);
    if (!nextGameId) {
      const error = "Invalid game";
      setMessage(error);
      return Promise.resolve({ success: false, error });
    }

    if (gameState.gameId === nextGameId) {
      return Promise.resolve({ success: true, gameId: nextGameId });
    }

    if (!isMultiplayer || !roomId) {
      const nextState = buildInitialLocalState(nextGameId);
      setGameState(nextState);
      gameIdRef.current = nextGameId;
      resetHistory(
        `Switched to ${getGameDisplayName(nextGameId)} • ${nextState.turn} to move`,
        "system",
        nextState.board
      );
      setShowModal(false);
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
      setSelection(null);
      setMessage(`Switched to ${getGameDisplayName(nextGameId)}`);
      return Promise.resolve({ success: true, gameId: nextGameId });
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      const error = "Connection failed";
      setMessage(error);
      return Promise.resolve({ success: false, error });
    }

    return new Promise((resolve) => {
      socket.emit("switchGame", { roomId, gameId: nextGameId }, (response) => {
        if (response?.error || response?.success === false) {
          const error = response?.error || "Failed to switch games";
          setMessage(error);
          resolve({ success: false, error });
          return;
        }

        setShowModal(false);
        setNewGameRequester(null);
        setNewGameRequestedAt(null);
        setSelection(null);
        setMessage(`Switched to ${getGameDisplayName(nextGameId)}`);
        resolve({ success: true, gameId: response?.gameId || nextGameId });
      });
    });
  }, [gameState.gameId, isMultiplayer, resetHistory, roomId]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current?.connected) {
      // In multiplayer, only emit to server - don't reset local state
      // Server will broadcast gameUpdate with zeroed scores
      socketRef.current.emit("resetScores", { roomId });
    } else {
      // Local game: reset everything
      setGameState(() => buildInitialLocalState());
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
      setGameState(buildInitialLocalState());
      setMessage("Left room");
      setPersistedRoom(null);
      resetHistory("Left room", "system");
      setShowModal(false);
      setNewGameRequester(null);
      setSelection(null);
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
    selection,
    legalTargets,
    clearSelection: () => setSelection(null),
    resetGame,
    resetScores,
    switchGame,
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

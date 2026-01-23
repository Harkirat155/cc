import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getDisplayName } from "../utils/randomName";
import { getClientId, setPersistedRoom, getPersistedRoom } from "../utils/clientId";
import useDisplayName from "./useDisplayName";
import useLobby from "./useLobby";
import useGameHistory from "./useGameHistory";

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
  const [connectionState, setConnectionState] = useState("disconnected");

  const socketRef = useRef(null);
  const pendingJoinRef = useRef(null);
  const clientIdRef = useRef(getClientId());
  const joinOnConnectHandlerRef = useRef(null);

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

  const getSocket = useCallback(() => socketRef.current, []);
  const {
    lobbyQueue,
    isInLobby,
    lobbyError,
    joinLobby,
    leaveLobby,
    handleLobbyUpdate,
    handleMatchFound,
  } = useLobby({ getSocket });

  const isMultiplayer = !!roomId;

  // Lazy socket init
  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const url =
      import.meta.env.VITE_SOCKET_SERVER ||
      window.location.origin.replace(/:\d+$/, ":8081");
    const s = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    s.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionState("disconnected");
    });

    socketRef.current = s;

    s.on("connect", () => {
      setConnectionState("connected");
      setMessage(() => (roomId ? `Connected as ${player || ""}` : "Connected"));

      // Handle pending join
      if (pendingJoinRef.current) {
        const code = pendingJoinRef.current;
        pendingJoinRef.current = null;
        s.emit(
          "joinRoom",
          { roomId: code, clientId: clientIdRef.current, displayName: getDisplayName() },
          (resp) => {
            if (resp?.error) {
              setMessage(resp.error);
              return;
            }
            if (resp?.player) setPlayer(resp.player);
          }
        );
      }

      // Auto-rejoin room after transient disconnect
      try {
        const saved = getPersistedRoom();
        const toJoin = roomId || saved;
        if (toJoin) {
          s.emit(
            "joinRoom",
            { roomId: toJoin, clientId: clientIdRef.current, displayName: getDisplayName() },
            (resp) => {
              if (resp?.error) {
                setMessage(resp.error);
                if (resp.error === "Room not found") setPersistedRoom(null);
                return;
              }
              if (resp?.player) setPlayer(resp.player);
              if (!roomId && toJoin) setRoomId(toJoin);
            }
          );
        }
      } catch {
        // ignore
      }
    });

    s.on("disconnect", () => {
      setConnectionState("disconnected");
      setMessage("Disconnected");
    });

    s.on("gameUpdate", (payload) => {
      const effectiveRoomId = payload.roomId || roomId;
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
    });

    s.on("gameReset", () => {
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
      setShowModal(false);
    });

    // Lobby events
    s.on("lobbyUpdate", handleLobbyUpdate);
    s.on("matchFound", ({ roomId: matchedRoomId, player: assignedPlayer, opponent }) => {
      handleMatchFound();
      setRoomId(matchedRoomId);
      setPlayer(assignedPlayer);
      setPersistedRoom(matchedRoomId);
      setMessage(`Matched with ${opponent}! You are ${assignedPlayer}`);
    });
    s.on("startGame", () => setMessage("Game started"));

    return s;
  }, [player, roomId, recordMove, handleLobbyUpdate, handleMatchFound]);

  const createRoom = useCallback(() => {
    const s = ensureSocket();
    const currentDisplayName = getDisplayName();
    s.emit("createRoom", { clientId: clientIdRef.current, displayName: currentDisplayName }, (resp) => {
      setRoomId(resp.roomId);
      setPlayer(resp.player);
      setIsRoomCreator(true);
      setMessage(`Room ${resp.roomId} created. Waiting for opponent...`);
      setPersistedRoom(resp.roomId);
    });
  }, [ensureSocket]);

  const joinRoom = useCallback(
    (code) => {
      try {
        const s = ensureSocket();
        const currentDisplayName = getDisplayName();
        const emitJoin = () => {
          s.emit(
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
              setIsRoomCreator(false);
              setMessage(
                `Joined room ${code}${resp?.player === "spectator" ? " as spectator" : ""}`
              );
              setPersistedRoom(code);
            }
          );
        };

        if (s.connected) {
          emitJoin();
        } else {
          if (joinOnConnectHandlerRef.current) {
            try {
              s.off("connect", joinOnConnectHandlerRef.current);
            } catch {
              console.warn("Failed to remove previous connect listener");
            }
          }
          const handler = () => {
            emitJoin();
            joinOnConnectHandlerRef.current = null;
          };
          joinOnConnectHandlerRef.current = handler;
          s.once("connect", handler);
          try {
            s.connect();
          } catch {
            console.warn("Socket connect() failed");
          }
          if (s.connected) {
            emitJoin();
            try {
              s.off("connect", handler);
            } catch {
              console.warn("Failed to remove connect listener");
            }
            joinOnConnectHandlerRef.current = null;
          }
        }
      } catch (e) {
        console.error("Join room error:", e);
      }
    },
    [ensureSocket]
  );

  const handleSquareClick = useCallback(
    (index) => {
      // Auto-resume to latest if viewing past
      resumeLatest();

      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current) return;
        if (player === "spectator") return;
        if (gameState.turn !== player) return;

        // Optimistic update
        setGameState((curr) => {
          if (curr.winner || curr.board[index] !== "") return curr;
          const board = curr.board.slice();
          board[index] = curr.turn;
          const result = calcWinner(board);
          const nextTurn = result ? curr.turn : curr.turn === "X" ? "O" : "X";
          const resultText = result
            ? result.winner === "draw"
              ? "Draw"
              : `${result.winner} wins`
            : `${nextTurn}'s turn`;
          const entryType = result ? (result.winner === "draw" ? "draw" : "win") : "move";

          recordMove(board, resultText, entryType);

          return {
            ...curr,
            board,
            turn: result ? curr.turn : nextTurn,
            winner: result ? result.winner : curr.winner,
            winningLine: result ? result.line : curr.winningLine,
          };
        });

        socketRef.current.emit("makeMove", { roomId, index });
        return;
      }

      // Local fallback
      setGameState((current) => {
        if (current.winner || current.board[index] !== "") return current;
        const board = current.board.slice();
        board[index] = current.turn;
        const result = calcWinner(board);
        let next = { ...current, board };

        if (result) {
          next.winner = result.winner;
          next.winningLine = result.line;
          if (result.winner === "X") next.xScore += 1;
          if (result.winner === "O") next.oScore += 1;
          setShowModal(true);
        } else {
          next.turn = current.turn === "X" ? "O" : "X";
        }

        const resultText = result
          ? result.winner === "draw"
            ? "Draw"
            : `${result.winner} wins`
          : `${next.turn}'s turn`;
        const entryType = result ? (result.winner === "draw" ? "draw" : "win") : "move";

        recordMove(board, resultText, entryType);
        return next;
      });
    },
    [isMultiplayer, player, roomId, gameState.turn, recordMove, resumeLatest]
  );

  const resetGame = useCallback(() => {
    finalizeCurrentGame(gameState.winner);

    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetGame", { roomId });
    } else {
      setGameState((s) => ({
        ...initialLocalState,
        xScore: s.xScore,
        oScore: s.oScore,
      }));
    }

    resetHistory("New game • X to move", "reset");
    setShowModal(false);
    setNewGameRequester(null);
  }, [finalizeCurrentGame, gameState.winner, isMultiplayer, roomId, resetHistory]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetScores", { roomId });
      return;
    }
    setGameState(() => ({ ...initialLocalState }));
    resetHistory("Scores reset • X to move", "system");
    setShowModal(false);
    setNewGameRequester(null);
  }, [isMultiplayer, roomId, resetHistory]);

  const leaveRoom = useCallback(() => {
    return new Promise((resolve) => {
      const currentRoomId = roomId;

      const doLocalCleanup = () => {
        try {
          finalizeCurrentGame(gameState.winner);
        } catch {
          // ignore
        }
        setRoomId(null);
        setPlayer(null);
        setIsRoomCreator(false);
        setMessage("Left room");
        setGameState(initialLocalState);
        setRoster({ X: null, O: null, spectators: [] });
        resetHistory("Left room", "system");
        setShowModal(false);
        setNewGameRequester(null);
        setPersistedRoom(null);
      };

      if (!isMultiplayer || !socketRef.current || !currentRoomId) {
        doLocalCleanup();
        resolve();
        return;
      }

      doLocalCleanup();

      try {
        socketRef.current.emit(
          "leaveRoom",
          { roomId: currentRoomId, clientId: clientIdRef.current },
          (resp) => {
            if (resp?.error) {
              setMessage(resp.error);
            }
            resolve();
          }
        );
      } catch (e) {
        console.warn("leaveRoom emit failed", e);
        resolve();
      }
    });
  }, [isMultiplayer, roomId, finalizeCurrentGame, gameState.winner, resetHistory]);

  // Cleanup socket on unmount
  useEffect(
    () => () => {
      socketRef.current?.disconnect();
    },
    []
  );

  // Display name update with server notification
  const updateDisplayName = useCallback(
    (newName) => {
      return baseUpdateDisplayName(newName, {
        onServerNotify: (trimmed) => {
          if (socketRef.current && roomId) {
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
      if (!isMultiplayer || !socketRef.current) return;
      setNewGameRequester(socketRef.current.id);
      setNewGameRequestedAt(Date.now());
      socketRef.current.emit("requestNewGame", { roomId });
    },
    cancelNewGameRequest: () => {
      if (!isMultiplayer || !socketRef.current) return;
      socketRef.current.emit("cancelNewGameRequest", { roomId });
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
    },
    socketId: socketRef.current?.id || null,
    socket: socketRef.current || null,
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

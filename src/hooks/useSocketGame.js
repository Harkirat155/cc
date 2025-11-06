import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  appendHistorySnapshot,
  createSystemEntry,
  detectChangedIndex,
} from "../utils/history";
import { shouldArchiveCompletedGame } from "../utils/completedGames";

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
  // Move-by-move history for the CURRENT (ongoing) game
  const [moveHistory, setMoveHistory] = useState(() => [
    createSystemEntry({
      board: emptyBoard(),
      message: "Game start • X to move",
      moveNumber: 0,
    }),
  ]);
  // Concise summaries of COMPLETED games
  const [completedGames, setCompletedGames] = useState([]); // {id, winner, draw, sequence:["X0","O4",...], totalMoves, finishedAt}
  // Sequence of moves for current game (compact form)
  const moveSequenceRef = useRef([]); // array of { mark, index }
  const lastArchivedSignatureRef = useRef(null);
  const lastBoardRef = useRef(emptyBoard());
  // Time-travel index (which snapshot user is viewing)
  const [viewIndex, setViewIndex] = useState(0); // 0..moveHistory.length-1
  const viewIndexRef = useRef(0);
  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null); // 'X' | 'O' | 'spectator'
  const [roster, setRoster] = useState({ X: null, O: null, spectators: [] });
  const [voiceRoster, setVoiceRoster] = useState({}); // { socketId: { muted: boolean } }
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [message, setMessage] = useState("Local game ready");
  const [showModal, setShowModal] = useState(false);
  const [newGameRequester, setNewGameRequester] = useState(null); // socket.id of requester
  const [newGameRequestedAt, setNewGameRequestedAt] = useState(null);
  
  // Lobby state
  const [lobbyQueue, setLobbyQueue] = useState([]); // [{socketId, displayName, joinedAt}]
  const [isInLobby, setIsInLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);
  
  const socketRef = useRef(null);
  const pendingJoinRef = useRef(null); // store room code if join called before socket ready
  // Stable clientId per browser tab/session for seat restoration across reconnects
  const clientIdRef = useRef(null);
  if (!clientIdRef.current) {
    try {
      const key = "cc_client_id";
      let id = (typeof window !== "undefined" && window.sessionStorage)
        ? window.sessionStorage.getItem(key)
        : null;
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        if (typeof window !== "undefined" && window.sessionStorage) {
          window.sessionStorage.setItem(key, id);
        }
      }
      clientIdRef.current = id;
    } catch {
      clientIdRef.current = Math.random().toString(36).slice(2);
    }
  }
  const persistedRoomKey = "cc_room_id";
  const safeSetPersistedRoom = (value) => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        if (value) window.sessionStorage.setItem(persistedRoomKey, value);
        else window.sessionStorage.removeItem(persistedRoomKey);
      }
    } catch {/* ignore */}
  };
  const safeGetPersistedRoom = () => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return window.sessionStorage.getItem(persistedRoomKey);
      }
    } catch {/* ignore */}
    return null;
  };
  // Track a one-time 'connect' listener for joinRoom to avoid stacking
  const joinOnConnectHandlerRef = useRef(null);

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
    });

    socketRef.current = s;

    s.on("connect", () => {
      setMessage((_prev) =>
        roomId ? `Connected as ${player || ""}` : "Connected"
      );
      // If there was a pending join request before socket was ready
      if (pendingJoinRef.current) {
        const code = pendingJoinRef.current;
        pendingJoinRef.current = null;
        s.emit("joinRoom", { roomId: code, clientId: clientIdRef.current }, (resp) => {
          if (resp?.error) {
            setMessage(resp.error);
            return;
          }
          if (resp?.player) setPlayer(resp.player);
        });
      }
      // If we were in a room before a transient disconnect, proactively re-join
      try {
        const saved = safeGetPersistedRoom();
        const toJoin = roomId || saved;
        if (toJoin) {
          s.emit("joinRoom", { roomId: toJoin, clientId: clientIdRef.current }, (resp) => {
            if (resp?.error) {
              setMessage(resp.error);
              if (resp.error === "Room not found") safeSetPersistedRoom(null);
              return;
            }
            if (resp?.player) setPlayer(resp.player);
            if (!roomId && toJoin) setRoomId(toJoin);
          });
        }
      } catch {/* ignore */}
    });
    s.on("disconnect", () => setMessage("Disconnected"));

    s.on("gameUpdate", (payload) => {
      const effectiveRoomId = payload.roomId || roomId;
      if (effectiveRoomId) safeSetPersistedRoom(effectiveRoomId);
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
        // winner state but no requester yet
        setNewGameRequester(null);
        setNewGameRequestedAt(null);
      }
      const resultText = payload.winner
        ? payload.winner === "draw"
          ? "Draw"
          : `${payload.winner} wins`
        : `${payload.turn}'s turn`;
      const boardSnapshot = Array.isArray(payload.board)
        ? payload.board.slice()
        : emptyBoard();
      const changedIndex = detectChangedIndex(
        lastBoardRef.current,
        boardSnapshot
      );
      const mark =
        changedIndex !== null && changedIndex >= 0
          ? boardSnapshot[changedIndex]
          : null;
      const entryType = payload.winner
        ? payload.winner === "draw"
          ? "draw"
          : "win"
        : "move";
      const timestamp = Date.now();
      setMoveHistory((historyList) => {
        const moveNumber =
          mark && changedIndex !== null
            ? moveSequenceRef.current.length + 1
            : historyList.length;
        const { history: nextHistory, appended } = appendHistorySnapshot(
          historyList,
          {
            board: boardSnapshot,
            result: resultText,
            type: entryType,
            moveNumber,
            mark,
            index: changedIndex,
            timestamp,
          }
        );
        if (appended && mark && changedIndex !== null) {
          moveSequenceRef.current.push({
            mark,
            index: changedIndex,
            timestamp,
          });
        }
        if (appended && viewIndexRef.current === historyList.length - 1) {
          setViewIndex(nextHistory.length - 1);
        }
        lastBoardRef.current = boardSnapshot.slice();
        return nextHistory;
      });
      if (payload.winner) setShowModal(true);
    });
    s.on("gameReset", () => {
      // Reset came from someone (maybe opponent). Clear requester flags & modal for everyone.
      setNewGameRequester(null);
      setNewGameRequestedAt(null);
      setShowModal(false);
    });
    
    // Lobby event listeners
    s.on("lobbyUpdate", ({ queue }) => {
      setLobbyQueue(queue || []);
    });

    s.on("matchFound", ({ roomId: matchedRoomId, player: assignedPlayer, opponent }) => {
      setIsInLobby(false);
      setRoomId(matchedRoomId);
      setPlayer(assignedPlayer);
      safeSetPersistedRoom(matchedRoomId);
      setMessage(`Matched with ${opponent}! You are ${assignedPlayer}`);
    });
    s.on("startGame", () => setMessage("Game started"));

    return s;
  }, [player, roomId]);

  const createRoom = useCallback(() => {
    const s = ensureSocket();
    s.emit("createRoom", { clientId: clientIdRef.current }, (resp) => {
      setRoomId(resp.roomId);
      setPlayer(resp.player);
      setIsRoomCreator(true);
      setMessage(`Room ${resp.roomId} created. Waiting for opponent...`);
      safeSetPersistedRoom(resp.roomId);
    });
  }, [ensureSocket]);

  const joinRoom = useCallback(
    (code) => {
      try {
      const s = ensureSocket();
      const emitJoin = () => {
        s.emit("joinRoom", { roomId: code, clientId: clientIdRef.current }, (resp) => {
          if (resp?.error) {
            setMessage(resp.error);
            if (resp.error === "Room not found") safeSetPersistedRoom(null);
            return;
          }
          if (resp?.player) setPlayer(resp.player);
          setRoomId(code);
          setIsRoomCreator(false);
          setMessage(
            `Joined room ${code}${
              resp?.player === "spectator" ? " as spectator" : ""
            }`
          );
          safeSetPersistedRoom(code);
        });
      };
      if (s.connected) {
        emitJoin();
      } else {
        // Ensure we emit right after the connection is established (avoid stacking listeners)
        if (joinOnConnectHandlerRef.current) {
          try { s.off("connect", joinOnConnectHandlerRef.current); } catch {
            console.warn("Failed to remove previous connect listener");
          }
        }
        const handler = () => {
          emitJoin();
          joinOnConnectHandlerRef.current = null;
        };
        joinOnConnectHandlerRef.current = handler;
        s.once("connect", handler);
        // Kick off connection if not already
        try { s.connect(); } catch {
          console.warn("Socket connect() failed");
        }
        // If it connected in-between, emit now
        if (s.connected) {
          emitJoin();
          try { s.off("connect", handler); } catch {
            console.warn("Failed to remove connect listener");
          }
          joinOnConnectHandlerRef.current = null;
        }
      }
      } catch (e) { console.error("Join room error:", e); };
    },
    [ensureSocket]
  );

  const handleSquareClick = useCallback(
    (index) => {
      // If user is viewing a past move, auto-resume latest before applying a move
      setViewIndex((currentIdx) => {
        const latest = moveHistory.length - 1;
        return currentIdx === latest ? currentIdx : latest;
      });
      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current) return;
        if (player === "spectator") return; // read-only
        // Prevent move if it's not this player's turn
        if (gameState.turn !== player) return;
        // Optimistic update for snappy UX; server will reconcile via gameUpdate
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
          const changedIndex = detectChangedIndex(
            lastBoardRef.current,
            board
          );
          const mark =
            changedIndex !== null && changedIndex >= 0 ? board[changedIndex] : null;
          const entryType = result
            ? result.winner === "draw"
              ? "draw"
              : "win"
            : "move";
          const timestamp = Date.now();
          // History optimistic append with de-duplication
          setMoveHistory((historyList) => {
            const moveNumber =
              mark && changedIndex !== null
                ? moveSequenceRef.current.length + 1
                : historyList.length;
            const { history: nextHistory, appended } = appendHistorySnapshot(
              historyList,
              {
                board,
                result: resultText,
                type: entryType,
                moveNumber,
                mark,
                index: changedIndex,
                timestamp,
              }
            );
            if (appended && mark && changedIndex !== null) {
              moveSequenceRef.current.push({
                mark,
                index: changedIndex,
                timestamp,
              });
            }
            if (appended && viewIndexRef.current === historyList.length - 1) {
              setViewIndex(nextHistory.length - 1);
            }
            lastBoardRef.current = board.slice();
            return nextHistory;
          });
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
        const changedIndex = detectChangedIndex(lastBoardRef.current, board);
        const mark =
          changedIndex !== null && changedIndex >= 0 ? board[changedIndex] : null;
        const entryType = result
          ? result.winner === "draw"
            ? "draw"
            : "win"
          : "move";
        const timestamp = Date.now();
        setMoveHistory((historyList) => {
          const moveNumber =
            mark && changedIndex !== null
              ? moveSequenceRef.current.length + 1
              : historyList.length;
          const { history: nextHistory, appended } = appendHistorySnapshot(
            historyList,
            {
              board,
              result: resultText,
              type: entryType,
              moveNumber,
              mark,
              index: changedIndex,
              timestamp,
            }
          );
          if (appended && mark && changedIndex !== null) {
            moveSequenceRef.current.push({
              mark,
              index: changedIndex,
              timestamp,
            });
          }
          if (appended && viewIndexRef.current === historyList.length - 1)
            setViewIndex(nextHistory.length - 1);
          lastBoardRef.current = board.slice();
          return nextHistory;
        });
        return next;
      });
    },
    // include gameState.turn to satisfy exhaustive-deps, but we only read it synchronously
    [isMultiplayer, player, roomId, moveHistory.length, gameState.turn]
  );

  const finalizeCurrentGameIfFinished = useCallback(() => {
    if (!gameState.winner) return; // only store completed

    const sequenceStrings = moveSequenceRef.current.map(
      (m) => `${m.mark ?? ""}${m.index ?? ""}`
    );
    const lastMoveTimestamp =
      moveSequenceRef.current.length > 0
        ? moveSequenceRef.current[moveSequenceRef.current.length - 1].timestamp
        : null;

    const { shouldArchive, signature } = shouldArchiveCompletedGame({
      lastSignature: lastArchivedSignatureRef.current,
      sequenceStrings,
      lastMoveTimestamp,
    });

    if (!shouldArchive) {
      lastArchivedSignatureRef.current = signature;
      return;
    }

    const summary = {
      id: Date.now(),
      winner: gameState.winner === "draw" ? null : gameState.winner,
      draw: gameState.winner === "draw",
      sequence: sequenceStrings,
      totalMoves: sequenceStrings.length,
      finishedAt: new Date().toISOString(),
    };

    setCompletedGames((g) => [...g, summary]);
    lastArchivedSignatureRef.current = signature;
  }, [gameState.winner]);

  const resetGame = useCallback(() => {
    // If current game finished, persist summary
    finalizeCurrentGameIfFinished();
    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetGame", { roomId });
      // After server reset, local state will update via event; prime local trackers
    } else {
      setGameState((s) => ({
        ...initialLocalState,
        xScore: s.xScore,
        oScore: s.oScore,
      }));
    }
    // Reset per-game tracking
    const freshBoard = emptyBoard();
    moveSequenceRef.current = [];
    lastBoardRef.current = freshBoard;
    setMoveHistory([
      createSystemEntry({
        board: freshBoard,
        message: "New game • X to move",
        moveNumber: 0,
        tag: "reset",
      }),
    ]);
    setViewIndex(0);
    setShowModal(false);
    setNewGameRequester(null);
  }, [finalizeCurrentGameIfFinished, isMultiplayer, roomId]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetScores", { roomId });
      return;
    }
    setGameState((_s) => ({ ...initialLocalState }));
    const freshBoard = emptyBoard();
    moveSequenceRef.current = [];
    lastBoardRef.current = freshBoard;
    setMoveHistory([
      createSystemEntry({
        board: freshBoard,
        message: "Scores reset • X to move",
        moveNumber: 0,
        tag: "system",
      }),
    ]);
    setViewIndex(0);
    setShowModal(false);
    setNewGameRequester(null);
  }, [isMultiplayer, roomId]);

  const leaveRoom = useCallback(() => {
    // Return a promise so callers can await before navigating
    return new Promise((resolve) => {
      // Snapshot current room before clearing for server ack
      const currentRoomId = roomId;

      const doLocalCleanup = () => {
        try { finalizeCurrentGameIfFinished(); } catch { /* ignore */ }
        setRoomId(null);
        setPlayer(null);
        setIsRoomCreator(false);
        setMessage("Left room");
        setGameState(initialLocalState);
        setRoster({ X: null, O: null, spectators: [] });
        moveSequenceRef.current = [];
        const freshBoard = emptyBoard();
        lastBoardRef.current = freshBoard;
        setMoveHistory([
          createSystemEntry({
            board: freshBoard,
            message: "Left room",
            moveNumber: 0,
            tag: "system",
          }),
        ]);
        setViewIndex(0);
        setShowModal(false);
        setNewGameRequester(null);
        safeSetPersistedRoom(null);
      };

      // If not in multiplayer or socket missing, just cleanup and resolve
      if (!isMultiplayer || !socketRef.current || !currentRoomId) {
        doLocalCleanup();
        resolve();
        return;
      }

      // Optimistically cleanup first to avoid URL flicker from auto-redirect effect
      doLocalCleanup();

      // Inform server; resolve regardless of ack result to not block UI
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
  }, [isMultiplayer, roomId, finalizeCurrentGameIfFinished]);

  // Join matchmaking lobby
  const joinLobby = useCallback((displayName) => {
    return new Promise((resolve, reject) => {
      const s = ensureSocket();
      if (!s) {
        reject(new Error('Socket not available'));
        return;
      }

      setLobbyError(null);
      
      s.emit('joinLobby', { displayName }, (response) => {
        if (response?.success) {
          setIsInLobby(true);
          resolve(response);
        } else {
          const error = response?.error || 'Failed to join lobby';
          setLobbyError(error);
          reject(new Error(error));
        }
      });
    });
  }, [ensureSocket]);

  // Leave matchmaking lobby
  const leaveLobby = useCallback(() => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) {
        resolve();
        return;
      }

      s.emit('leaveLobby', (response) => {
        setIsInLobby(false);
        setLobbyError(null);
        resolve(response);
      });
    });
  }, []);

  // Cleanup socket on unmount
  useEffect(
    () => () => {
      socketRef.current?.disconnect();
    },
    []
  );

  return {
    gameState,
    history: moveHistory,
    completedGames,
    viewIndex,
    displayedBoard:
      moveHistory[Math.min(viewIndex, moveHistory.length - 1)].squares,
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
      // Set requester locally for instant UI feedback
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
    jumpTo: (idx) => {
      if (idx < 0 || idx >= moveHistory.length) return;
      setViewIndex(idx);
    },
    resumeLatest: () => setViewIndex(moveHistory.length - 1),
    // Lobby methods
    lobbyQueue,
    isInLobby,
    lobbyError,
    joinLobby,
    leaveLobby,
  };
}

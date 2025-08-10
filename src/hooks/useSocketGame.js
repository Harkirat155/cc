import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

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
  const [history, setHistory] = useState([emptyBoard()]);
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null); // 'X' | 'O' | 'spectator'
  const [message, setMessage] = useState("Local game ready");
  const [showModal, setShowModal] = useState(false);
  const socketRef = useRef(null);
  const pendingJoinRef = useRef(null); // store room code if join called before socket ready

  const isMultiplayer = !!roomId;

  // Lazy socket init
  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const url =
      import.meta.env.VITE_SOCKET_SERVER ||
      window.location.origin.replace(/:\d+$/, ":5123");
    const s = io(url, { autoConnect: true });
    socketRef.current = s;

    s.on("connect", () => {
      setMessage((prev) =>
        roomId ? `Connected as ${player || ""}` : "Connected"
      );
      // If there was a pending join request before socket was ready
      if (pendingJoinRef.current) {
        const code = pendingJoinRef.current;
        pendingJoinRef.current = null;
        s.emit("joinRoom", { roomId: code }, (resp) => {
          if (resp?.error) {
            setMessage(resp.error);
            return;
          }
          if (resp?.player) setPlayer(resp.player);
        });
      }
    });
    s.on("disconnect", () => setMessage("Disconnected"));

    s.on("gameUpdate", (payload) => {
      setRoomId(payload.roomId || roomId);
      setGameState((prev) => ({ ...prev, ...payload }));
      setHistory((h) => [...h, payload.board.slice()]);
      if (payload.winner) {
        setShowModal(true);
      }
    });
    s.on("startGame", () => setMessage("Game started"));

    return s;
  }, [player, roomId]);

  const createRoom = useCallback(() => {
    const s = ensureSocket();
    s.emit("createRoom", (resp) => {
      setRoomId(resp.roomId);
      setPlayer(resp.player);
      setMessage(`Room ${resp.roomId} created. Waiting for opponent...`);
    });
  }, [ensureSocket]);

  const joinRoom = useCallback(
    (code) => {
      const s = ensureSocket();
      if (s.connected) {
        s.emit("joinRoom", { roomId: code }, (resp) => {
          if (resp?.error) {
            setMessage(resp.error);
            return;
          }
          if (resp?.player) setPlayer(resp.player);
          setRoomId(code);
          setMessage(
            `Joined room ${code}${
              resp?.player === "spectator" ? " as spectator" : ""
            }`
          );
        });
      } else {
        // store for later
        pendingJoinRef.current = code;
      }
    },
    [ensureSocket]
  );

  const handleSquareClick = useCallback(
    (index) => {
      // Multiplayer path
      if (isMultiplayer) {
        if (!socketRef.current) return;
        if (player === "spectator") return; // read-only
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
        setHistory((h) => [...h, board]);
        return next;
      });
    },
    [isMultiplayer, player, roomId]
  );

  const resetGame = useCallback(() => {
    if (isMultiplayer && socketRef.current) {
  socketRef.current.emit("resetGame", { roomId });
      setShowModal(false);
      return;
    }
    // Local
    setGameState((s) => ({
      ...initialLocalState,
      xScore: s.xScore,
      oScore: s.oScore,
    }));
    setHistory([emptyBoard()]);
    setShowModal(false);
  }, [isMultiplayer, roomId]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetScores", { roomId });
      return;
    }
    setGameState((s) => ({ ...initialLocalState }));
    setHistory([emptyBoard()]);
    setShowModal(false);
  }, [isMultiplayer, roomId]);

  const leaveRoom = useCallback(() => {
    if (!isMultiplayer || !socketRef.current) return;
    socketRef.current.emit('leaveRoom', { roomId }, (resp) => {
      if (resp?.error){ setMessage(resp.error); return; }
      setRoomId(null);
      setPlayer(null);
      setMessage('Left room');
      setGameState(initialLocalState);
      setHistory([emptyBoard()]);
      setShowModal(false);
    });
  }, [isMultiplayer, roomId]);

  // Cleanup socket on unmount
  useEffect(
    () => () => {
      socketRef.current?.disconnect();
    },
    []
  );

  return {
    gameState,
    history,
    message,
    roomId,
    player,
    isMultiplayer,
    showModal,
    setShowModal,
    createRoom,
    joinRoom,
    handleSquareClick,
    resetGame,
    resetScores,
  leaveRoom,
  };
}

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
  // Move-by-move history for the CURRENT (ongoing) game
  const [moveHistory, setMoveHistory] = useState([{ squares: emptyBoard(), result: 'Game start: X to move' }]);
  // Concise summaries of COMPLETED games
  const [completedGames, setCompletedGames] = useState([]); // {id, winner, draw, sequence:["X0","O4",...], totalMoves, finishedAt}
  // Sequence of moves for current game (compact form)
  const moveSequenceRef = useRef([]); // array of { mark, index }
  const lastBoardRef = useRef(emptyBoard());
  // Time-travel index (which snapshot user is viewing)
  const [viewIndex, setViewIndex] = useState(0); // 0..moveHistory.length-1
  const viewIndexRef = useRef(0);
  useEffect(() => { viewIndexRef.current = viewIndex; }, [viewIndex]);
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
      const resultText = payload.winner
        ? (payload.winner === 'draw' ? 'Draw' : `${payload.winner} wins`)
        : `${payload.turn}'s turn`;
      setMoveHistory((h) => {
        const last = h[h.length - 1];
        if (last && last.squares && last.squares.every((v, i) => v === payload.board[i])) {
          return h; // duplicate board state
        }
        // Detect changed cell to append to sequence
        const prevBoard = lastBoardRef.current;
        let changedIndex = null;
        for (let i=0;i<payload.board.length;i++) if (prevBoard[i] !== payload.board[i]) { changedIndex = i; break; }
        if (changedIndex !== null) {
          moveSequenceRef.current.push({ mark: payload.board[changedIndex], index: changedIndex });
        }
        lastBoardRef.current = payload.board.slice();
        const next = [...h, { squares: payload.board.slice(), result: resultText }];
        // Auto-follow if user was at latest
        if (viewIndexRef.current === h.length - 1) {
          setViewIndex(next.length - 1);
        }
        return next;
      });
      if (payload.winner) setShowModal(true);
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
          const nextTurn = result ? curr.turn : (curr.turn === 'X' ? 'O' : 'X');
          const resultText = result ? (result.winner === 'draw' ? 'Draw' : `${result.winner} wins`) : `${nextTurn}'s turn`;
          // History optimistic append
          setMoveHistory((h) => {
            const last = h[h.length -1];
            if (last && last.squares.every((v,i)=> v===board[i])) return h;
            const placedIndex = board.findIndex((cell, idx) => cell !== last.squares[idx]);
            if (placedIndex >= 0) moveSequenceRef.current.push({ mark: board[placedIndex], index: placedIndex });
            lastBoardRef.current = board.slice();
            const nextArr = [...h, { squares: board.slice(), result: resultText }];
            if (viewIndexRef.current === h.length -1) setViewIndex(nextArr.length -1);
            return nextArr;
          });
          return {
            ...curr,
            board,
            turn: result ? curr.turn : nextTurn,
            winner: result ? result.winner : curr.winner,
            winningLine: result ? result.line : curr.winningLine
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
          ? (result.winner === 'draw' ? 'Draw' : `${result.winner} wins`)
          : `${next.turn}'s turn`;
        setMoveHistory((h) => {
          const last = h[h.length - 1];
          if (last && last.squares && last.squares.every((v,i) => v === board[i])) return h;
          // Record move in sequence
          const placedIndex = board.findIndex((cell, idx) => cell !== last.squares[idx]);
          if (placedIndex >= 0) moveSequenceRef.current.push({ mark: board[placedIndex], index: placedIndex });
          lastBoardRef.current = board.slice();
      const nextArr = [...h, { squares: board.slice(), result: resultText }];
      if (viewIndexRef.current === h.length - 1) setViewIndex(nextArr.length - 1);
      return nextArr;
        });
        return next;
      });
    },
    [isMultiplayer, player, roomId, moveHistory.length]
  );

  const finalizeCurrentGameIfFinished = useCallback(() => {
    if (!gameState.winner) return; // only store completed
    // Avoid duplicating if already stored (check last completed sequence string)
    const seqStr = moveSequenceRef.current.map(m => m.mark+""+m.index).join('-');
    if (completedGames.length && completedGames[completedGames.length-1].sequence.join('-') === seqStr) return;
    setCompletedGames(g => [...g, {
      id: Date.now(),
      winner: gameState.winner === 'draw' ? null : gameState.winner,
      draw: gameState.winner === 'draw',
      sequence: moveSequenceRef.current.map(m => m.mark+""+m.index),
      totalMoves: moveSequenceRef.current.length,
      finishedAt: new Date().toISOString()
    }]);
  }, [gameState.winner, completedGames]);

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
    moveSequenceRef.current = [];
    lastBoardRef.current = emptyBoard();
    setMoveHistory([{ squares: emptyBoard(), result: 'New game: X to move' }]);
  setViewIndex(0);
    setShowModal(false);
  }, [finalizeCurrentGameIfFinished, isMultiplayer, roomId]);

  const resetScores = useCallback(() => {
    if (isMultiplayer && socketRef.current) {
      socketRef.current.emit("resetScores", { roomId });
      return;
    }
    setGameState((s) => ({ ...initialLocalState }));
    moveSequenceRef.current = [];
    lastBoardRef.current = emptyBoard();
    setMoveHistory([{ squares: emptyBoard(), result: 'Scores reset: X to move' }]);
  setViewIndex(0);
    setShowModal(false);
  }, [isMultiplayer, roomId]);

  const leaveRoom = useCallback(() => {
    if (!isMultiplayer || !socketRef.current) return;
    socketRef.current.emit('leaveRoom', { roomId }, (resp) => {
      if (resp?.error){ setMessage(resp.error); return; }
      finalizeCurrentGameIfFinished();
      setRoomId(null);
      setPlayer(null);
      setMessage('Left room');
      setGameState(initialLocalState);
      moveSequenceRef.current = [];
      lastBoardRef.current = emptyBoard();
      setMoveHistory([{ squares: emptyBoard(), result: 'Left room' }]);
  setViewIndex(0);
      setShowModal(false);
    });
  }, [isMultiplayer, roomId, finalizeCurrentGameIfFinished]);

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
    displayedBoard: moveHistory[Math.min(viewIndex, moveHistory.length -1)].squares,
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
    jumpTo: (idx) => {
      if (idx < 0 || idx >= moveHistory.length) return;
      setViewIndex(idx);
    },
    resumeLatest: () => setViewIndex(moveHistory.length -1),
  };
}

import express from "express";
import http from "http";
import { Server } from "socket.io";
import compression from "compression";

// Config
const PORT = process.env.PORT || 5123;
const ROOM_LIMIT = parseInt(process.env.ROOM_LIMIT || "500", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Helpers
const initialState = () => ({
  board: Array(9).fill(""),
  turn: "X",
  winner: null,
  winningLine: [],
  xScore: 0,
  oScore: 0,
});
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
  for (const [a, b, c] of LINES)
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a, b, c] };
  if (board.every((c) => c !== "")) return { winner: "draw", line: [] };
  return null;
}
function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++)
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// LRU rooms map: roomId -> { players: {X, O}, spectators: Set, state }
const rooms = new Map();
// Track which rooms a socket participates in for O(1) disconnect cleanup.
// socketId -> Set(roomId)
const socketRooms = new Map();
const touch = (id) => {
  const r = rooms.get(id);
  if (!r) return;
  rooms.delete(id);
  rooms.set(id, r);
};
const enforceLRU = () => {
  while (rooms.size > ROOM_LIMIT) {
    const oldest = rooms.keys().next().value;
    rooms.delete(oldest);
  }
};

// Express + Socket.IO setup
const app = express();
app.use(compression());
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

function publish(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit("gameUpdate", { ...room.state, roomId });
}

io.on("connection", (socket) => {
  socket.on("createRoom", (ack) => {
    let roomId = genCode();
    while (rooms.has(roomId)) roomId = genCode();
    rooms.set(roomId, {
      players: { X: socket.id, O: null },
      spectators: new Set(),
      state: initialState(),
    });
    socket.join(roomId);
  // map socket -> room
  let set = socketRooms.get(socket.id); if (!set){ set = new Set(); socketRooms.set(socket.id, set); }
  set.add(roomId);
    enforceLRU();
    ack?.({ roomId, player: "X" });
    publish(roomId);
  });

  socket.on("joinRoom", ({ roomId }, ack) => {
    const room = rooms.get(roomId);
    if (!room) return ack?.({ error: "Room not found" });
    touch(roomId);
    let role;
    if (!room.players.X) {
      room.players.X = socket.id;
      role = "X";
    } else if (!room.players.O) {
      room.players.O = socket.id;
      role = "O";
    } else if (room.players.X === socket.id) role = "X";
    else if (room.players.O === socket.id) role = "O";
    else {
      room.spectators.add(socket.id);
      role = "spectator";
    }
    socket.join(roomId);
  let set = socketRooms.get(socket.id); if (!set){ set = new Set(); socketRooms.set(socket.id, set); }
  set.add(roomId);
    ack?.({ player: role });
    if (room.players.X && room.players.O) io.to(roomId).emit("startGame");
    publish(roomId);
  });

  socket.on("makeMove", ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    touch(roomId);
    const { state, players } = room;
    const mark =
      players.X === socket.id ? "X" : players.O === socket.id ? "O" : null;
    if (
      !mark ||
      state.winner ||
      state.turn !== mark ||
      state.board[index] !== ""
    )
      return;
    state.board[index] = mark;
    const result = calcWinner(state.board);
    if (result) {
      state.winner = result.winner;
      state.winningLine = result.line;
      if (result.winner === "X") state.xScore += 1;
      if (result.winner === "O") state.oScore += 1;
    } else {
      state.turn = state.turn === "X" ? "O" : "X";
    }
    publish(roomId);
  });

  socket.on("resetGame", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    touch(roomId);
    const { xScore, oScore } = room.state;
    room.state = { ...initialState(), turn: room.state.turn, xScore, oScore };
    publish(roomId);
  });

  socket.on("resetScores", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    touch(roomId);
    room.state.xScore = 0;
    room.state.oScore = 0;
    publish(roomId);
  });

  socket.on("leaveRoom", ({ roomId }, ack) => {
    const room = rooms.get(roomId);
    if (!room) return ack?.({ error: "Room not found" });
    let changed = false;
    if (room.players.X === socket.id) {
      room.players.X = null;
      changed = true;
    }
    if (room.players.O === socket.id) {
      room.players.O = null;
      changed = true;
    }
    if (room.spectators.delete(socket.id)) changed = true;
    if (changed) {
      if (!room.players.X && !room.players.O && room.spectators.size === 0) {
        rooms.delete(roomId);
      } else publish(roomId);
      // remove mapping
      const set = socketRooms.get(socket.id); if (set){ set.delete(roomId); if (set.size === 0) socketRooms.delete(socket.id); }
      return ack?.({ ok: true });
    }
    ack?.({ error: "Not in room" });
  });

  socket.on("disconnect", () => {
    const set = socketRooms.get(socket.id);
    if (!set){ return; }
    for (const roomId of set.values()){
      const room = rooms.get(roomId);
      if (!room) continue;
      let changed = false;
      if (room.players.X === socket.id) { room.players.X = null; changed = true; }
      if (room.players.O === socket.id) { room.players.O = null; changed = true; }
      if (room.spectators.delete(socket.id)) changed = true;
      if (changed){
        if (!room.players.X && !room.players.O && room.spectators.size === 0) rooms.delete(roomId); else publish(roomId);
      }
    }
    socketRooms.delete(socket.id);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Realtime server listening on ${PORT}`);
});

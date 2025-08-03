const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://harkirat155.github.io", // Your GitHub Pages URL
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(compression());

const rooms = new Map(); // Store room data: { roomId: { players: [], board: [], turn: 'X', winner: null } }

app.get("/health", (req, res) => {
  res.status(200).send("Server is running");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create a new game room
  socket.on("createRoom", (callback) => {
    const roomId = uuidv4();
    rooms.set(roomId, {
      players: [socket.id],
      board: Array(9).fill(""),
      turn: "X",
      winner: null,
      xScore: 0,
      oScore: 0,
    });
    socket.join(roomId);
    callback({ roomId, player: "X" });
    io.to(roomId).emit("gameUpdate", rooms.get(roomId));
  });

  // Join an existing room
  socket.on("joinRoom", ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ error: "Room not found" });
    }
    if (room.players.length >= 2) {
      return callback({ error: "Room is full" });
    }
    room.players.push(socket.id);
    socket.join(roomId);
    callback({ player: "O" });
    io.to(roomId).emit("gameUpdate", rooms.get(roomId));
    io.to(roomId).emit("startGame");
  });

  // Handle a player's move
  socket.on("makeMove", ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (!room || room.winner || room.board[index] !== "") return;

    if (
      (room.turn === "X" && socket.id === room.players[0]) ||
      (room.turn === "O" && socket.id === room.players[1])
    ) {
      room.board[index] = room.turn;
      const winner = calculateWinner(room.board);
      if (winner) {
        room.winner = winner;
        if (winner === "X") room.xScore++;
        else if (winner === "O") room.oScore++;
      } else if (room.board.every((cell) => cell !== "")) {
        room.winner = "draw";
      }
      room.turn = room.turn === "X" ? "O" : "X";
      rooms.set(roomId, room);
      io.to(roomId).emit("gameUpdate", room);
    }
  });

  // Reset game
  socket.on("resetGame", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.board = Array(9).fill("");
      room.winner = null;
      room.turn = "X";
      rooms.set(roomId, room);
      io.to(roomId).emit("gameUpdate", room);
    }
  });

  // Reset scores
  socket.on("resetScores", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.xScore = 0;
      room.oScore = 0;
      rooms.set(roomId, room);
      io.to(roomId).emit("gameUpdate", room);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter((id) => id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit("playerDisconnected", { message: "Opponent disconnected" });
        }
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Helper function to calculate winner
function calculateWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6], // Diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
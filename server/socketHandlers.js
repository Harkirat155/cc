// Socket event handlers
import { calcWinner, genCode, initialState } from './gameLogic.js';
import { rooms, socketRooms, touch, enforceLRU, publish } from './roomManager.js';

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("createRoom", (ack) => {
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      rooms.set(roomId, {
        players: { X: socket.id, O: null },
        spectators: new Set(),
        state: initialState(),
        voice: {}, // socketId -> { muted: boolean }
      });
      socket.join(roomId);
      let set = socketRooms.get(socket.id); if (!set){ set = new Set(); socketRooms.set(socket.id, set); }
      set.add(roomId);
      enforceLRU();
      ack?.({ roomId, player: "X" });
      publish(io, roomId);
    });

    socket.on("joinRoom", ({ roomId }, ack) => {
      roomId = (roomId || "").trim().toUpperCase();
      if (!roomId) return ack?.({ error: "Invalid room ID" });
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
      publish(io, roomId);
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
      publish(io, roomId);
    });

    socket.on("resetGame", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      const { xScore, oScore, board, winner } = room.state;
      let newTurn = "X";
      if (Array.isArray(board)) {
        // Get move order
        let order = [];
        for (let i = 0; i < board.length; i++) {
          if (board[i] !== "") order.push(board[i]);
        }
        if (winner && winner !== "draw" && order.length >= 1) {
          // Winner just played last move, loser is the other mark
          const lastMark = order[order.length - 1];
          newTurn = lastMark === "X" ? "O" : "X";
        } else if (winner === "draw" && order.length >= 2) {
          // Draw: second last mover goes first
          newTurn = order[order.length - 2] || "X";
        }
      }
      room.state = { ...initialState(), turn: newTurn, xScore, oScore };
      publish(io, roomId);
      io.to(roomId).emit("gameReset", { roomId });
    });

    socket.on("resetScores", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      room.state.xScore = 0;
      room.state.oScore = 0;
      publish(io, roomId);
    });

    socket.on("requestNewGame", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      room.state.newGameRequester = socket.id;
      room.state.newGameRequestedAt = Date.now();
      publish(io, roomId);
    });

    socket.on("cancelNewGameRequest", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      // Only requester or opponent can clear; keep simple and allow anyone in room
      room.state.newGameRequester = null;
      room.state.newGameRequestedAt = null;
      publish(io, roomId);
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
      if (room.voice && room.voice[socket.id]) {
        delete room.voice[socket.id];
        changed = true;
      }
      if (changed) {
        if (!room.players.X && !room.players.O && room.spectators.size === 0) {
          rooms.delete(roomId);
        } else publish(io, roomId);
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
        if (room.voice && room.voice[socket.id]) { delete room.voice[socket.id]; changed = true; }
        if (changed){
          if (!room.players.X && !room.players.O && room.spectators.size === 0) rooms.delete(roomId); else publish(io, roomId);
        }
      }
      socketRooms.delete(socket.id);
    });

    // Voice signaling and state
    socket.on("voice:join", ({ roomId, muted }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      if (!room.voice) room.voice = {};
      room.voice[socket.id] = { muted: !!muted };
      // Notify others that this socket joined voice
      socket.to(roomId).emit("voice:user-joined", { socketId: socket.id, muted: !!muted });
      publish(io, roomId);
    });

    socket.on("voice:leave", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.voice) return;
      touch(roomId);
      if (room.voice[socket.id]) delete room.voice[socket.id];
      socket.to(roomId).emit("voice:user-left", { socketId: socket.id });
      publish(io, roomId);
    });

    socket.on("voice:mute-state", ({ roomId, muted }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      touch(roomId);
      if (!room.voice) room.voice = {};
      if (!room.voice[socket.id]) room.voice[socket.id] = { muted: !!muted };
      else room.voice[socket.id].muted = !!muted;
      socket.to(roomId).emit("voice:mute-state", { socketId: socket.id, muted: !!muted });
      publish(io, roomId);
    });

    // WebRTC signaling exchange within room (one-to-many fanout controlled by client)
    socket.on("voice:signal", ({ roomId, targetId, data }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Relay only to target within the room
      // Note: no strict membership check here; relies on client-provided room. Could be hardened.
      socket.to(targetId).emit("voice:signal", { from: socket.id, data, roomId });
    });
  });
}

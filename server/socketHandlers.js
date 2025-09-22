// Socket event handlers
import { calcWinner, genCode, initialState } from "./gameLogic.js";
import {
  rooms,
  socketRooms,
  touch,
  enforceLRU,
  publish,
} from "./roomManager.js";

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Create a room; support optional payload { clientId }
    socket.on("createRoom", (payloadOrAck, maybeAck) => {
      let payload = {};
      let ack = maybeAck;
      if (typeof payloadOrAck === "function") {
        ack = payloadOrAck;
      } else if (payloadOrAck && typeof payloadOrAck === "object") {
        payload = payloadOrAck;
      }
      const clientId = (payload && payload.clientId) || null;
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      rooms.set(roomId, {
        players: { X: socket.id, O: null },
        spectators: new Set(),
        state: initialState(),
        voice: {}, // socketId -> { muted: boolean }
        seatByClient: clientId ? { [clientId]: "X" } : {},
        lastTouched: Date.now(),
      });
      // Optional debug log
      try {
        console.debug(
          `[createRoom] room=${roomId} socket=${socket.id} client=${
            clientId || "-"
          } -> X`
        );
      } catch {
        /* noop */
      }
      socket.join(roomId);
      let set = socketRooms.get(socket.id);
      if (!set) {
        set = new Set();
        socketRooms.set(socket.id, set);
      }
      set.add(roomId);
      enforceLRU();
      ack?.({ roomId, player: "X" });
      publish(io, roomId);
    });

    // Join a room; supports { roomId, clientId }
    socket.on("joinRoom", ({ roomId, clientId }, ack) => {
      roomId = (roomId || "").trim().toUpperCase();
      if (!roomId) return ack?.({ error: "Invalid room ID" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ error: "Room not found" });
      touch(roomId);
      let role;
      // Normalize metadata containers
      if (!room.seatByClient) room.seatByClient = {};

      // 1) If clientId previously had a reserved seat, always rebind that seat
      if (!role && clientId && room.seatByClient[clientId]) {
        const seat = room.seatByClient[clientId]; // 'X' | 'O'
        if (seat === "X" || seat === "O") {
          // Rebind seat to this socket (handles refresh/quick reconnect) ONLY if free or already this socket
          if (!room.players[seat] || room.players[seat] === socket.id) {
            room.players[seat] = socket.id;
            // Ensure the same socket isn't occupying both seats
            const other = seat === "X" ? "O" : "X";
            if (room.players[other] === socket.id) room.players[other] = null;
            role = seat;
            try {
              console.debug(
                `[joinRoom] rebind seat room=${roomId} seat=${seat} socket=${socket.id} client=${clientId}`
              );
            } catch {
              /* noop */
            }
          }
        }
      }

      // 2) If this socket already occupies a seat, honor it
      if (!role) {
        if (room.players.X === socket.id) role = "X";
        else if (room.players.O === socket.id) role = "O";
      }

      // 3) Otherwise, seat to an open slot (X then O). Do NOT assign a second seat to the same client.
      if (!role) {
        if (!room.players.X) {
          room.players.X = socket.id;
          role = "X";
          if (clientId) room.seatByClient[clientId] = "X";
        } else if (!room.players.O) {
          // Guard: if clientId already mapped to X/O, don't give them the other seat
          const mapped = clientId ? room.seatByClient[clientId] : null;
          if (mapped === "X" || mapped === "O") {
            // Client already owns a seat; join as spectator instead of double seating
            room.spectators.add(socket.id);
            role = "spectator";
            try {
              console.debug(
                `[joinRoom] client already seated (${mapped}), joining spectator room=${roomId} socket=${socket.id} client=${clientId}`
              );
            } catch {
              /* noop */
            }
          } else {
            room.players.O = socket.id;
            role = "O";
            if (clientId) room.seatByClient[clientId] = "O";
            try {
              console.debug(
                `[joinRoom] seated O room=${roomId} socket=${
                  socket.id
                } client=${clientId || "-"}`
              );
            } catch {
              /* noop */
            }
          }
        } else {
          room.spectators.add(socket.id);
          role = "spectator";
          try {
            console.debug(
              `[joinRoom] room full -> spectator room=${roomId} socket=${socket.id}`
            );
          } catch {
            /* noop */
          }
        }
      }

      // Final safety: ensure a single socket isn't occupying both seats
      if (room.players.X === socket.id && room.players.O === socket.id) {
        // Prefer the seat dictated by seatByClient mapping if present
        const prefer = (clientId && room.seatByClient[clientId] != null ? room.seatByClient[clientId] : (role ?? "X"));
        if (prefer === "X") room.players.O = null;
        else room.players.X = null;
      }
      socket.join(roomId);
      let set = socketRooms.get(socket.id);
      if (!set) {
        set = new Set();
        socketRooms.set(socket.id, set);
      }
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

    socket.on("leaveRoom", ({ roomId, clientId }, ack) => {
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
      // Free seat reservation only on explicit leave
      if (
        clientId &&
        room.seatByClient &&
        (room.seatByClient[clientId] === "X" ||
          room.seatByClient[clientId] === "O")
      ) {
        delete room.seatByClient[clientId];
      }
      if (changed) {
        touch(roomId);
        // Ensure socket leaves the Socket.IO room to stop receiving events
        try {
          socket.leave(roomId);
        } catch {
          /* ignore */
        }
        // Do not delete immediately; allow GC to remove after TTL if empty
        publish(io, roomId);
        const set = socketRooms.get(socket.id);
        if (set) {
          set.delete(roomId);
          if (set.size === 0) socketRooms.delete(socket.id);
        }
        return ack?.({ ok: true });
      }
      ack?.({ error: "Not in room" });
    });

    socket.on("disconnect", () => {
      const set = socketRooms.get(socket.id);
      if (!set) {
        return;
      }
      for (const roomId of set.values()) {
        const room = rooms.get(roomId);
        if (!room) continue;
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
          touch(roomId);
          // Keep room for a grace period; GC will remove after TTL
          publish(io, roomId);
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
      socket
        .to(roomId)
        .emit("voice:user-joined", { socketId: socket.id, muted: !!muted });
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
      socket
        .to(roomId)
        .emit("voice:mute-state", { socketId: socket.id, muted: !!muted });
      publish(io, roomId);
    });

    // WebRTC signaling exchange within room (one-to-many fanout controlled by client)
    socket.on("voice:signal", ({ roomId, targetId, data }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Relay only to target within the room
      // Note: no strict membership check here; relies on client-provided room. Could be hardened.
      socket
        .to(targetId)
        .emit("voice:signal", { from: socket.id, data, roomId });
    });
  });
}

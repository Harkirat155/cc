// Room and socket management

const ROOM_LIMIT = parseInt(process.env.ROOM_LIMIT || "500", 10);
export const rooms = new Map(); // roomId -> { players, spectators, state, voice }
export const socketRooms = new Map(); // socketId -> Set(roomId)

export function touch(id) {
  const r = rooms.get(id);
  if (!r) return;
  rooms.delete(id);
  rooms.set(id, r);
}

export function enforceLRU() {
  while (rooms.size > ROOM_LIMIT) {
    const oldest = rooms.keys().next().value;
    rooms.delete(oldest);
  }
}

export function publish(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const roster = {
    X: room.players.X,
    O: room.players.O,
    spectators: Array.from(room.spectators || []),
  };
  // voiceRoster: { [socketId]: { muted: boolean } }
  const voiceRoster = {};
  if (room.voice) {
    for (const [sid, v] of Object.entries(room.voice)) {
      voiceRoster[sid] = { muted: !!(v && v.muted) };
    }
  }
  io.to(roomId).emit("gameUpdate", { ...room.state, roomId, roster, voiceRoster });
}

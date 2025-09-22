// Room and socket management

const ROOM_LIMIT = parseInt(process.env.ROOM_LIMIT || "500", 10);
const ROOM_TTL_MS = parseInt(process.env.ROOM_TTL_MS || "120000", 10); // 120s inactivity TTL for empty rooms
export const rooms = new Map(); // roomId -> { players, spectators, state, voice, lastTouched }
export const socketRooms = new Map(); // socketId -> Set(roomId)

export function touch(id) {
  const r = rooms.get(id);
  if (!r) return;
  // update last activity timestamp and move to the end for LRU ordering
  r.lastTouched = Date.now();
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

// Start a lightweight GC loop that removes rooms which have been empty and inactive beyond TTL
export function startRoomGC() {
  // use globalThis.setInterval to avoid bundler/ESLint env confusion
  globalThis.setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      const hasOccupants = !!(room.players?.X || room.players?.O || (room.spectators && room.spectators.size > 0));
      if (hasOccupants) continue;
      const last = room.lastTouched || 0;
      if (now - last > ROOM_TTL_MS) {
        rooms.delete(roomId);
      }
    }
  }, 10_000); // check every 10s
}

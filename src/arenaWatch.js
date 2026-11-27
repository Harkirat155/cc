// Live names are display names, so a match is a name match, never proof of identity.
export const normName = (x) => String(x ?? "").normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();

const key = (gameId, name) => `${gameId}\u0000${normName(name)}`;

// Map of gameId+name -> roomId, first listed game wins.
export function watchRooms(liveGames) {
  const rooms = new Map();
  if (!Array.isArray(liveGames)) return rooms;
  for (const g of liveGames) {
    if (typeof g?.roomId !== "string" || !g.roomId || typeof g.gameId !== "string" || !Array.isArray(g.players)) continue;
    for (const p of g.players) {
      if (typeof p === "string" && !rooms.has(key(g.gameId, p))) rooms.set(key(g.gameId, p), g.roomId);
    }
  }
  return rooms;
}

export const roomFor = (rooms, gameId, name) => rooms.get(key(gameId, name));

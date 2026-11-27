// Live names are display names, so a match is a name match, never proof of identity.
export function watchRooms(liveGames) {
  const rooms = new Map();
  if (!Array.isArray(liveGames)) return rooms;
  for (const g of liveGames) {
    for (const p of Array.isArray(g?.players) ? g.players : []) {
      const key = String(p).toLowerCase();
      if (g.roomId && !rooms.has(key)) rooms.set(key, g.roomId);
    }
  }
  return rooms;
}

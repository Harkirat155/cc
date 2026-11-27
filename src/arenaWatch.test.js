import { watchRooms } from "./arenaWatch";

const live = [
  { roomId: "r1", gameId: "connect4", players: ["Ada Bot", "Sam"] },
  { roomId: "r2", gameId: "ttt", players: ["Zed", "ada bot"] },
  { roomId: "r3", gameId: "ttt", players: ["Nobody", "Else"] },
];

describe("watchRooms", () => {
  it("maps a lowercased name to the first live room that has a player of that name", () => {
    const rooms = watchRooms(live);
    expect(rooms.get("ada bot")).toBe("r1");
    expect(rooms.get("zed")).toBe("r2");
    expect(rooms.get("sam")).toBe("r1");
  });

  it("returns nothing for a name that is in no live game, and tolerates bad input", () => {
    expect(watchRooms(live).get("grace bot")).toBeUndefined();
    expect(watchRooms(null).size).toBe(0);
    expect(watchRooms([{ roomId: "x" }]).size).toBe(0);
  });
});

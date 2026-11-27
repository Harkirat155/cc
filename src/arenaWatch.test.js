import { watchRooms, roomFor, normName } from "./arenaWatch";

const live = [
  { roomId: "r1", gameId: "connect4", players: ["Ada Bot", "Sam"] },
  { roomId: "r2", gameId: "ttt", players: ["Zed", "ada bot"] },
  { roomId: "r3", gameId: "ttt", players: ["Nobody", "Else"] },
];

describe("watchRooms", () => {
  it("links a name only within the game it is playing, ignoring case", () => {
    const rooms = watchRooms(live);
    expect(roomFor(rooms, "connect4", "ADA bot")).toBe("r1");
    expect(roomFor(rooms, "ttt", "Ada Bot")).toBe("r2");
    expect(roomFor(rooms, "ttt", "Sam")).toBeUndefined(); // Sam plays connect4 only
    expect(roomFor(rooms, "checkers", "Ada Bot")).toBeUndefined();
  });

  it("returns nothing for a name in no live game, and tolerates bad input", () => {
    expect(roomFor(watchRooms(live), "ttt", "Grace Bot")).toBeUndefined();
    expect(watchRooms(null).size).toBe(0);
    expect(watchRooms([{ roomId: "x", gameId: "ttt" }]).size).toBe(0);
    expect(watchRooms([{ roomId: 5, gameId: "ttt", players: ["A"] }, { roomId: "ok", gameId: "ttt", players: [7, null, "B"] }]).size).toBe(1);
    expect(roomFor(watchRooms(live), "ttt", undefined)).toBeUndefined();
  });

  it("treats whitespace and NFD vs NFC spellings as the same name", () => {
    expect(normName("  Ada   Bot ")).toBe("ada bot");
    expect(normName("Zoé")).toBe(normName("Zoé"));
    const rooms = watchRooms([{ roomId: "r7", gameId: "ttt", players: ["Zoé ", "x"] }]);
    expect(roomFor(rooms, "ttt", "ZOé")).toBe("r7");
  });
});

import { soundFor, viewerSlotFor } from "./sound";

const s = (over) => ({ gameId: "ttt", status: "active", board: Array(9).fill(null), turnSlot: 0, winnerSlot: null, ...over });
const afterMove = (prev, over) => s({ board: ["X", ...prev.board.slice(1)], turnSlot: 1, ...over });

describe("soundFor", () => {
  const a = s();
  it("is silent on the first state", () => {
    expect(soundFor(null, a, 0)).toBeNull();
  });
  it("is silent when nothing changed", () => {
    expect(soundFor(a, { ...a }, 0)).toBeNull();
  });
  it("plays a move sound, higher for your own move", () => {
    expect(soundFor(a, afterMove(a), 0)).toBe("moveMine");
    expect(soundFor(a, afterMove(a), 1)).toBe("moveTheirs");
  });
  it("plays win, loss and draw on the terminal state", () => {
    const won = afterMove(a, { status: "win", winnerSlot: 0 });
    expect(soundFor(a, won, 0)).toBe("win");
    expect(soundFor(a, won, 1)).toBe("loss");
    expect(soundFor(a, afterMove(a, { status: "draw", winnerSlot: "draw" }), 1)).toBe("draw");
  });
  it("gives spectators move sounds only", () => {
    expect(soundFor(a, afterMove(a), null)).toBe("moveTheirs");
    expect(soundFor(a, afterMove(a, { status: "win", winnerSlot: 0 }), null)).toBe("moveTheirs");
  });
  it("is silent when muted", () => {
    expect(soundFor(a, afterMove(a), 0, true)).toBeNull();
  });
  it("is silent on a reset, a game switch or a state that is already over", () => {
    const over = afterMove(a, { status: "win", winnerSlot: 0 });
    expect(soundFor(over, a, 0)).toBeNull();
    expect(soundFor(a, s({ gameId: "connect4", board: Array(42).fill(null) }), 0)).toBeNull();
    expect(soundFor(over, { ...over, board: ["O", ...over.board.slice(1)] }, 0)).toBeNull();
  });
});

describe("viewerSlotFor", () => {
  it("maps the X/O seat to a slot for every game, whatever its colour labels", () => {
    expect(viewerSlotFor({ player: "X", isMultiplayer: true, botSlot: null })).toBe(0);
    expect(viewerSlotFor({ player: "O", isMultiplayer: true, botSlot: null })).toBe(1);
  });
  it("is null for a spectator and for a local two-player game", () => {
    expect(viewerSlotFor({ player: null, isMultiplayer: true, botSlot: null })).toBeNull();
    expect(viewerSlotFor({ player: "X", isMultiplayer: false, botSlot: null })).toBeNull();
  });
  it("is the human's slot against the computer", () => {
    expect(viewerSlotFor({ player: null, isMultiplayer: false, botSlot: 1 })).toBe(0);
  });
});

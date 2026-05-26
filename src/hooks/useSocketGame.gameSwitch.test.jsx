/**
 * Integration test for the local-mode game switching UX.
 *
 * Covers local-mode game switching and deep-link initialisation so the selected
 * rules engine can change without a document reload.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@shared/games/index.js";
import { get as getGameRules } from "@shared/games/registry.js";

const mockSocketHandlers = new Map();
const mockSocket = {
  id: "sock1",
  connected: true,
  on: jest.fn((event, handler) => mockSocketHandlers.set(event, handler)),
  off: jest.fn((event) => mockSocketHandlers.delete(event)),
  emit: jest.fn(),
};

jest.mock("../utils/socketManager", () => ({
  getSocket: jest.fn(() => mockSocket),
  waitForConnection: jest.fn(() => Promise.resolve(mockSocket)),
  isConnected: jest.fn(() => false),
  getSocketId: jest.fn(() => mockSocket.id),
  addListener: jest.fn(() => () => {}),
}));

import useSocketGame from "./useSocketGame";

beforeEach(() => {
  mockSocketHandlers.clear();
  mockSocket.id = "sock1";
  mockSocket.connected = true;
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.emit.mockReset();
});

function setSearch(qs) {
  window.history.replaceState({}, "", qs ? `/${qs.startsWith("?") ? qs : `?${qs}`}` : "/");
}

async function mountWithSearch(qs) {
  setSearch(qs);
  let snapshot;
  function Probe() {
    const game = useSocketGame();
    snapshot = game;
    return (
      <div>
        <div data-testid="gameId">{game.gameState.gameId}</div>
        <div data-testid="rows">{game.gameState.boardSpec?.rows ?? ""}</div>
        <div data-testid="cols">{game.gameState.boardSpec?.cols ?? ""}</div>
        <div data-testid="moveStyle">{game.gameState.moveStyle ?? ""}</div>
        <div data-testid="cellCount">{game.gameState.board.length}</div>
      </div>
    );
  }
  await act(async () => {
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
  });
  return () => snapshot;
}

describe("useSocketGame — local game selection via ?game=", () => {
  test("defaults to TTT when no ?game= present", async () => {
    await mountWithSearch("");
    expect(screen.getByTestId("gameId").textContent).toBe("ttt");
    expect(screen.getByTestId("rows").textContent).toBe("3");
    expect(screen.getByTestId("cols").textContent).toBe("3");
    expect(screen.getByTestId("cellCount").textContent).toBe("9");
    expect(screen.getByTestId("moveStyle").textContent).toBe("place");
  });

  test("?game=connect4 boots a 7x6 placement board", async () => {
    await mountWithSearch("?game=connect4");
    expect(screen.getByTestId("gameId").textContent).toBe("connect4");
    expect(screen.getByTestId("cols").textContent).toBe("7");
    expect(screen.getByTestId("rows").textContent).toBe("6");
    expect(screen.getByTestId("cellCount").textContent).toBe("42");
    expect(screen.getByTestId("moveStyle").textContent).toBe("place");
  });

  test("?game=checkers boots an 8x8 select-target board with 24 pieces", async () => {
    const snap = await mountWithSearch("?game=checkers");
    expect(screen.getByTestId("gameId").textContent).toBe("checkers");
    expect(screen.getByTestId("cols").textContent).toBe("8");
    expect(screen.getByTestId("rows").textContent).toBe("8");
    expect(screen.getByTestId("cellCount").textContent).toBe("64");
    expect(screen.getByTestId("moveStyle").textContent).toBe("select-target");
    const pieceCount = snap().gameState.board.filter(
      (c) => c && typeof c === "object"
    ).length;
    expect(pieceCount).toBe(24);
  });

  test("unknown ?game= falls back to TTT", async () => {
    await mountWithSearch("?game=nonsense");
    expect(screen.getByTestId("gameId").textContent).toBe("ttt");
  });

  test("switchGame in local mode switches state and resets history in place", async () => {
    const snap = await mountWithSearch("?game=ttt");

    await act(async () => {
      snap().handleSquareClick(0);
    });
    expect(snap().history).toHaveLength(2);

    let result;
    await act(async () => {
      result = await snap().switchGame("checkers");
    });

    expect(result).toEqual({ success: true, gameId: "checkers" });
    expect(snap().gameState.gameId).toBe("checkers");
    expect(snap().gameState.board).toHaveLength(64);
    expect(snap().history).toHaveLength(1);
    expect(snap().history[0].squares).toHaveLength(64);
    expect(snap().displayedBoard).toHaveLength(64);
    expect(snap().selection).toBeNull();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  test("local checkers click flow: select piece then play a step move", async () => {
    const snap = await mountWithSearch("?game=checkers");
    expect(snap().gameState.gameId).toBe("checkers");
    // Slot-0 starts; pick the man at (5,0) → index 40. Step forward to (4,1) = 33.
    await act(async () => {
      snap().handleSquareClick(40);
    });
    expect(snap().gameState.board[40]).toEqual({ type: "man", owner: 0 });
    await act(async () => {
      snap().handleSquareClick(33);
    });
    expect(snap().gameState.board[40]).toBe("");
    expect(snap().gameState.board[33]).toEqual({ type: "man", owner: 0 });
    expect(snap().gameState.turnSlot).toBe(1);
  });

  test("joinLobby emits the selected game id", async () => {
    const snap = await mountWithSearch("?game=connect4");
    mockSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "joinLobby") ack?.({ success: true, position: 0 });
    });

    await act(async () => {
      await snap().joinLobby("Player One", "connect4");
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "joinLobby",
      { displayName: "Player One", gameId: "connect4" },
      expect.any(Function)
    );
  });

  test("switchGame emits over the existing room socket", async () => {
    const snap = await mountWithSearch("?game=ttt");
    mockSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "createRoom") ack?.({ roomId: "ROOM1", player: "X" });
      if (event === "switchGame") ack?.({ success: true, gameId: payload.gameId });
    });

    await act(async () => {
      await snap().createRoom("ttt");
    });
    await act(async () => {
      await snap().switchGame("checkers");
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "switchGame",
      { roomId: "ROOM1", gameId: "checkers" },
      expect.any(Function)
    );
  });

  test("gameUpdate with new game id resets history to the new board", async () => {
    const snap = await mountWithSearch("?game=ttt");
    mockSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "createRoom") ack?.({ roomId: "ROOM1", player: "X" });
    });

    await act(async () => {
      await snap().createRoom("ttt");
    });

    const rules = getGameRules("checkers");
    const state = rules.createInitialState();
    await act(async () => {
      mockSocketHandlers.get("gameUpdate")({
        roomId: "ROOM1",
        gameId: "checkers",
        board: state.board,
        turn: rules.playerInfo[0].label,
        turnSlot: state.turn,
        winner: null,
        winnerSlot: null,
        winningLine: [],
        winningCells: [],
        scores: state.scores,
        xScore: 0,
        oScore: 0,
        status: state.status,
        playerInfo: rules.playerInfo,
        boardSpec: rules.boardSpec,
        moveStyle: rules.moveStyle,
        roster: { X: "sock1", O: "sock2", spectators: [] },
      });
    });

    expect(snap().gameState.gameId).toBe("checkers");
    expect(snap().history).toHaveLength(1);
    expect(snap().history[0].squares).toHaveLength(64);
    expect(snap().displayedBoard).toHaveLength(64);
  });
});

import React from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@shared/games/index.js";

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

let game;
const mount = async () => {
  const Probe = () => {
    game = useSocketGame();
    return null;
  };
  await act(async () => {
    render(<MemoryRouter><Probe /></MemoryRouter>);
  });
};
const join = async () => {
  mockSocket.emit.mockImplementation((ev, _p, ack) => ev === "joinRoom" && ack({ player: "X" }));
  await act(async () => { await game.joinRoom("ABCDE"); });
};

beforeEach(() => {
  mockSocketHandlers.clear();
  mockSocket.connected = true;
  mockSocket.emit.mockReset();
});

test("sendRoomAction reports whether it emitted: no room and no connection both say false", async () => {
  await mount();
  expect(game.sendRoomAction("emote", { emote: "👍" })).toBe(false);
  await join();
  mockSocket.connected = false;
  expect(game.sendRoomAction("emote", { emote: "👍" })).toBe(false);
  mockSocket.connected = true;
  expect(game.sendRoomAction("emote", { emote: "👍" })).toBe(true);
  expect(mockSocket.emit).toHaveBeenCalledWith("emote", { roomId: "ABCDE", emote: "👍" });
});

test("two emotes in the same millisecond get different ids", async () => {
  await mount();
  await join();
  jest.spyOn(Date, "now").mockReturnValue(1000);
  act(() => { mockSocketHandlers.get("emote")({ slot: 0, emote: "👍" }); });
  const first = game.emote.id;
  act(() => { mockSocketHandlers.get("emote")({ slot: 0, emote: "👍" }); });
  expect(game.emote.id).not.toBe(first);
  Date.now.mockRestore();
});

test("leaving the room clears the last emote", async () => {
  await mount();
  await join();
  act(() => { mockSocketHandlers.get("emote")({ slot: 1, emote: "🔥" }); });
  expect(game.emote).toMatchObject({ slot: 1, emote: "🔥" });
  await act(async () => { await game.leaveRoom(); });
  expect(game.emote).toBeNull();
});

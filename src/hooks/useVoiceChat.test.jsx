import React from "react";
import { act, render } from "@testing-library/react";
import useVoiceChat from "./useVoiceChat";

const mockPeerInstances = [];
const mockPeerConstructor = jest.fn((options) => {
  const handlers = {};
  const peer = {
    destroyed: false,
    options,
    signal: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
      return peer;
    }),
    destroy: jest.fn(() => {
      peer.destroyed = true;
      handlers.close?.();
    }),
  };
  mockPeerInstances.push(peer);
  return peer;
});

jest.mock("simple-peer/simplepeer.min.js", () => ({
  __esModule: true,
  default: mockPeerConstructor,
}));

function createSocket() {
  const handlers = {};
  return {
    handlers,
    emit: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    off: jest.fn((event, handler) => {
      if (handlers[event] === handler) {
        delete handlers[event];
      }
    }),
  };
}

function Harness({ socket }) {
  useVoiceChat({
    socket,
    roomId: "ROOM1",
    selfId: "self",
    roster: {},
    voiceRoster: {},
  });
  return null;
}

describe("useVoiceChat", () => {
  beforeEach(() => {
    mockPeerInstances.length = 0;
    mockPeerConstructor.mockClear();
  });

  test("reuses one peer when rapid signals arrive before peer creation resolves", async () => {
    const socket = createSocket();
    render(<Harness socket={socket} />);

    await act(async () => {
      socket.handlers["voice:signal"]({ from: "remote", data: { type: "offer" } });
      socket.handlers["voice:signal"]({ from: "remote", data: { candidate: "ice" } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPeerConstructor).toHaveBeenCalledTimes(1);
    expect(mockPeerInstances[0].signal).toHaveBeenCalledTimes(2);
    expect(mockPeerInstances[0].signal).toHaveBeenNthCalledWith(1, { type: "offer" });
    expect(mockPeerInstances[0].signal).toHaveBeenNthCalledWith(2, { candidate: "ice" });
  });
});

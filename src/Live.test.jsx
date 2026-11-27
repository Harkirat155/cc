/* global process */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Live, { ago, liveUrl } from "./Live";

const show = () => render(<MemoryRouter><Live /></MemoryRouter>);

afterEach(() => { delete window.fetch; delete process.env.VITE_SOCKET_SERVER; });

describe("Live page", () => {
  it("lists each game with a Watch link to its room", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ roomId: "K7P2M", gameId: "connect4", players: ["Ada", "Bo"], moves: 1, startedAt: Date.now() }] }) });
    show();
    expect(await screen.findByText("Ada vs Bo")).toBeTruthy();
    expect(screen.getByText(/1 move ·/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Watch" }).getAttribute("href")).toBe("/room/K7P2M");
  });

  it("says when nothing is live, and states the listing rule", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [] }) });
    show();
    expect(await screen.findByText(/No listed games right now/)).toBeTruthy();
    expect(screen.getByText(/never listed/)).toBeTruthy();
  });

  it("shows an error, not an empty list, when the request fails", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    show();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/);
    expect(screen.queryByText(/No listed games/)).toBeNull();
  });

  it("maps a ws base to http and formats ages", () => {
    process.env.VITE_SOCKET_SERVER = "wss://cc-api.example.dev/";
    expect(liveUrl()).toBe("https://cc-api.example.dev/api/live");
    expect(ago(0, 30_000)).toBe("just now");
    expect(ago(0, 5 * 60_000)).toBe("5 min ago");
  });
});

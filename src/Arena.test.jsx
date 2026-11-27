/* global process */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Arena, { apiBase } from "./Arena";

const show = () => render(<MemoryRouter><Arena /></MemoryRouter>);

afterEach(() => { delete window.fetch; delete process.env.VITE_SOCKET_SERVER; });

describe("Arena page", () => {
  it("states the rule and ranks bots per game", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } }) });
    show();
    expect(await screen.findByText("Ada Bot")).toBeTruthy();
    expect(screen.getByText("1216")).toBeTruthy();
    expect(screen.getByText(/Rated: games a registered bot finishes against anyone\. Elo, K=32, everyone starts at 1200\./)).toBeTruthy();
  });

  it("tells a bot author how to register when nothing is rated yet", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ games: {} }) });
    show();
    expect(await screen.findByText(/No rated bot has finished a game yet/)).toBeTruthy();
    expect(screen.getByText(/-X POST .*\/api\/bots/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "agents page" }).getAttribute("href")).toBe("/agents");
  });

  it("shows an error, not the empty state, when the request fails", async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    show();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/);
    expect(screen.queryByText(/No rated bot/)).toBeNull();
  });

  it("maps a ws base to http", () => {
    process.env.VITE_SOCKET_SERVER = "wss://cc-api.example.dev/";
    expect(apiBase()).toBe("https://cc-api.example.dev");
  });
});

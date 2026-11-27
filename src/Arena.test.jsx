/* global process */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

  it("links a row to the room of a live player with the same name, and says only that a player has that name", async () => {
    const arena = { games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }, { name: 42, rating: 1, games: 0, wins: 0, draws: 0, losses: 0 }, { name: "Grace Bot", rating: 1200, games: 1, wins: 0, draws: 1, losses: 0 }] } };
    window.fetch = jest.fn(async (url) => ({ ok: true, json: async () => (String(url).endsWith("/api/live") ? { games: [{ roomId: "r9 /?", gameId: "connect4", players: ["ada bot", "Sam"] }, { roomId: "r8", gameId: "ttt", players: ["Grace Bot", "Sam"] }] } : arena) }));
    show();
    const link = await screen.findByRole("link", { name: "A player named Ada Bot is in a game · Watch" });
    expect(link.getAttribute("href")).toBe("/room/r9%20%2F%3F");
    expect(screen.queryByRole("link", { name: /Grace Bot/ })).toBeNull();
  });

  it("still renders the leaderboard, with no links and no error, when /api/live fails", async () => {
    const arena = { games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } };
    window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? { ok: false, status: 500 } : { ok: true, json: async () => arena }));
    show();
    expect(await screen.findByText("Ada Bot")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: /Watch$/ })).toBeNull();
  });

  it("maps a ws base to http", () => {
    process.env.VITE_SOCKET_SERVER = "wss://cc-api.example.dev/";
    expect(apiBase()).toBe("https://cc-api.example.dev");
  });

  it("shows the badge Markdown to copy by hand when the clipboard refuses", async () => {
    window.fetch = jest.fn(async (url) => ({ ok: true, json: async () => (String(url).endsWith("/api/live") ? { games: [] } : { games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } }) }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Badge" }));
    const field = await screen.findByRole("textbox", { name: "Badge Markdown for Ada Bot" });
    expect(field.value).toBe("[![CrissCross rating](https://cc-api.harkirat-hira.workers.dev/api/arena/badge/Ada%20Bot.svg?game=connect4)](https://harkirat155.github.io/cc/arena)");
    expect(screen.getByRole("button", { name: "Copy failed: select the text below" })).toBeTruthy();
  });

  describe("recent games", () => {
    const row = { games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } };
    const stub = (recent) => { window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? { ok: true, json: async () => ({ games: [] }) } : String(url).includes("/api/arena/Ada%20Bot") ? recent : { ok: true, json: async () => row })); };

    it("expands a bot's last games on demand, one compact line each", async () => {
      stub({ ok: true, json: async () => ({ name: "Ada Bot", games: [{ gameId: "ttt", opponent: "House (easy)", result: "win", ratingAfter: 1216, at: 1 }, { gameId: "ttt", opponent: "guest", result: "loss", ratingAfter: 1200, at: 0 }] }) });
      show();
      const btn = await screen.findByRole("button", { name: "Ada Bot: last 10 games" });
      expect(window.fetch.mock.calls.some(([u]) => String(u).includes("/api/arena/Ada"))).toBe(false);
      fireEvent.click(btn);
      expect(await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216")).toBeTruthy();
      expect(screen.getByText("Lost vs guest · Tic-Tac-Toe · 1200")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Badge" })).toBeTruthy();
    });

    it("keeps the newest answer when an older request for the same bot lands last, and keeps loaded data on re-expand", async () => {
      const pending = [];
      window.fetch = jest.fn((url) => (String(url).endsWith("/api/live") ? Promise.resolve({ ok: true, json: async () => ({ games: [] }) })
        : String(url).includes("/api/arena/Ada%20Bot") ? new Promise((res) => pending.push(res)) : Promise.resolve({ ok: true, json: async () => row })));
      const reply = (g) => ({ ok: true, json: async () => ({ name: "Ada Bot", games: [{ gameId: "ttt", opponent: g, result: "win", ratingAfter: 1216, at: 1 }] }) });
      show();
      const btn = await screen.findByRole("button", { name: "Ada Bot: last 10 games" });
      fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn); // open, close, open again: two requests
      await waitFor(() => expect(pending).toHaveLength(2));
      await act(async () => { pending[1](reply("Newer")); });
      await act(async () => { pending[0](reply("Older")); });
      expect(await screen.findByText("Won vs Newer · Tic-Tac-Toe · 1216")).toBeTruthy();
      expect(screen.queryByText(/Older/)).toBeNull();
      fireEvent.click(btn); fireEvent.click(btn); // collapse, expand: loaded data stays visible while it refetches
      expect(screen.getByText("Won vs Newer · Tic-Tac-Toe · 1216")).toBeTruthy();
      expect(screen.queryByText(/Loading/)).toBeNull();
    });

    it("labels the button, points aria-controls at the region, and announces loading politely", async () => {
      window.fetch = jest.fn((url) => (String(url).endsWith("/api/live") ? Promise.resolve({ ok: true, json: async () => ({ games: [] }) })
        : String(url).includes("/api/arena/Ada%20Bot") ? new Promise(() => {}) : Promise.resolve({ ok: true, json: async () => row })));
      show();
      const btn = await screen.findByRole("button", { name: "Ada Bot: last 10 games" });
      fireEvent.click(btn);
      const region = document.getElementById(btn.getAttribute("aria-controls"));
      expect(region).toBeTruthy();
      expect(region.getAttribute("aria-live")).toBe("polite");
      expect(region.textContent).toMatch(/Loading/);
    });

    it("says so when the games cannot be loaded", async () => {
      stub({ ok: false, status: 500 });
      show();
      fireEvent.click(await screen.findByRole("button", { name: "Ada Bot: last 10 games" }));
      expect(await screen.findByText("Could not load this bot's games")).toBeTruthy();
    });

    it("says since when games are recorded when there are none", async () => {
      stub({ ok: true, json: async () => ({ name: "Ada Bot", games: [] }) });
      show();
      fireEvent.click(await screen.findByRole("button", { name: "Ada Bot: last 10 games" }));
      expect(await screen.findByText("No rated games recorded since 2026-11-28")).toBeTruthy();
    });
  });
});

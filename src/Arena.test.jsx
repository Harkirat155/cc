/* global process */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
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
    expect(screen.queryByRole("link", { name: /Grace Bot is in a game/ })).toBeNull();
  });

  it("still renders the leaderboard, with no links and no error, when /api/live fails", async () => {
    const arena = { games: { connect4: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } };
    window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? { ok: false, status: 500 } : { ok: true, json: async () => arena }));
    show();
    expect(await screen.findByText("Ada Bot")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: /Watch$/ })).toBeNull();
  });

  const routed = (feed, arena = { games: { ttt: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }] } }) => jest.fn(async (url) => {
    const u = String(url);
    if (u.endsWith("/api/live")) return { ok: true, json: async () => ({ games: [] }) };
    if (u.endsWith("/api/arena-feed")) return feed;
    return { ok: true, json: async () => arena };
  });

  it("lists just-finished games above the tables, linking only a name that could have a page", async () => {
    const feed = { ok: true, json: async () => ({ feed: [
      { name: "Grace Bot", gameId: "ttt", result: "win", ratingAfter: 1216, at: Date.now() - 5 * 60_000 },
      { name: "House (easy)", gameId: "connect4", result: "draw", ratingAfter: 1200, at: Date.now() - 3 * 86_400_000 },
    ] }) };
    window.fetch = routed(feed);
    show();
    const strip = await screen.findByRole("region", { name: "Just finished" });
    expect(strip.textContent).toMatch(/The last 2 rated results since 2026-11-28, one line per bot, so a game between two bots shows twice/);
    expect(strip.textContent).toMatch(/Grace Bot · Tic-Tac-Toe · Won · rating 1216 · 5 min ago/);
    expect(strip.textContent).toMatch(/House \(easy\) · Connect Four · Drew · rating 1200 · 3 d ago/);
    const links = strip.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/arena/Grace%20Bot");
  });

  it("says plainly that nothing has finished, with no zeros", async () => {
    window.fetch = routed({ ok: true, json: async () => ({ feed: [] }) });
    show();
    expect(await screen.findByText("No rated games finished since 2026-11-28.")).toBeTruthy();
  });

  it("keeps the leaderboard and shows a quiet note when the feed fails", async () => {
    window.fetch = routed({ ok: false, status: 500 });
    show();
    expect(await screen.findByText("Ada Bot")).toBeTruthy();
    expect(screen.getByText("Recent games are not available right now.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("treats a malformed feed as unavailable, not as an empty arena", async () => {
    window.fetch = routed({ ok: true, json: async () => ({ items: [] }) });
    show();
    expect(await screen.findByText("Recent games are not available right now.")).toBeTruthy();
    expect(screen.queryByText(/No rated games finished/)).toBeNull();
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
    const field = await screen.findByRole("textbox", { name: "Badge Markdown for Ada Bot, Connect Four" });
    expect(field.value).toBe("[![CrissCross rating](https://cc-api.harkirat-hira.workers.dev/api/arena/badge/Ada%20Bot.svg?game=connect4)](https://harkirat155.github.io/cc/arena/Ada%20Bot)");
    expect(screen.getByRole("button", { name: "Copy failed: select the text below" })).toBeTruthy();
  });

  it("links each registered name to its page, and leaves a House name as plain text", async () => {
    const two = { games: { ttt: [{ name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 }, { name: "House (easy)", rating: 1250, games: 9, wins: 5, draws: 0, losses: 4 }] } };
    window.fetch = jest.fn(async (url) => ({ ok: true, json: async () => (String(url).endsWith("/api/live") ? { games: [] } : two) }));
    show();
    expect((await screen.findByRole("link", { name: "Ada Bot" })).getAttribute("href")).toBe("/arena/Ada%20Bot");
    expect(screen.getByText("House (easy)")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "House (easy)" })).toBeNull();
  });
});

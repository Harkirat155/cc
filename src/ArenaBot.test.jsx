import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ArenaBot from "./ArenaBot";

const ok = (b) => ({ ok: true, json: async () => b });
const games = [{ gameId: "ttt", opponent: "House (easy)", result: "win", ratingAfter: 1216, at: 1 }, { gameId: "connect4", opponent: "guest", result: "loss", ratingAfter: 1190, at: 0 }];
const stub = ({ bot = ok({ name: "Ada Bot", games }), live = ok({ games: [] }) } = {}) => {
  window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? live : bot));
};
const show = (name = "Ada%20Bot") => render(<MemoryRouter initialEntries={[`/arena/${name}`]}><Routes><Route path="/arena/:name" element={<ArenaBot />} /></Routes></MemoryRouter>);

afterEach(() => { delete window.fetch; });

describe("bot page", () => {
  it("shows the name, the rule, and the last games as one line each", async () => {
    stub();
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Ada Bot" })).toBeTruthy();
    expect(screen.getByText(/Rated: games a registered bot finishes against anyone\. Elo, K=32, everyone starts at 1200\./)).toBeTruthy();
    expect(await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216")).toBeTruthy();
    expect(screen.getByText("Lost vs guest · Connect Four · 1190")).toBeTruthy();
    expect(screen.getByText(/Last 10 rated games since 2026-11-28/)).toBeTruthy();
    expect(window.fetch.mock.calls.some(([u]) => String(u).endsWith("/api/arena/Ada%20Bot"))).toBe(true);
  });

  it("says so, with a retry, when the games cannot be loaded, and recovers", async () => {
    stub({ bot: { ok: false, status: 500 } });
    show();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/);
    stub();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says no bot has this name, with the since line, on a 404", async () => {
    stub({ bot: { ok: false, status: 404 } });
    show("Nobody");
    expect(await screen.findByText(/No bot named Nobody is registered/)).toBeTruthy();
    expect(screen.getByText(/since 2026-11-28/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the Arena" }).getAttribute("href")).toBe("/arena");
  });

  it("says a registered bot has no rated games since the start of history", async () => {
    stub({ bot: ok({ name: "Ada Bot", games: [] }) });
    show();
    expect(await screen.findByText("No rated games recorded since 2026-11-28")).toBeTruthy();
  });

  it("says the House has no page and does not fetch", () => {
    stub();
    show("House%20(easy)");
    expect(screen.getByText(/has no page/)).toBeTruthy();
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it("links to the live room of a player with this name, and says only that a player has that name", async () => {
    stub({ live: ok({ games: [{ roomId: "r9 /?", gameId: "ttt", players: ["ada bot", "Sam"] }] }) });
    show();
    const link = await screen.findByRole("link", { name: "A player named Ada Bot is in a game · Watch" });
    expect(link.getAttribute("href")).toBe("/room/r9%20%2F%3F");
    expect(screen.getByText(/Playing now/)).toBeTruthy();
  });

  it("shows no playing-now line when /api/live fails", async () => {
    stub({ live: { ok: false, status: 500 } });
    show();
    await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216");
    expect(screen.queryByText(/Playing now/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers badge Markdown per game type that links to this page, with a hand-copy fallback", async () => {
    stub();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });
    show();
    await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216");
    expect(screen.getAllByRole("button", { name: /^Badge/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Badge: Tic-Tac-Toe" }));
    const field = await screen.findByRole("textbox", { name: "Badge Markdown for Ada Bot" });
    expect(field.value).toBe("[![CrissCross rating](https://cc-api.harkirat-hira.workers.dev/api/arena/badge/Ada%20Bot.svg?game=ttt)](https://harkirat155.github.io/cc/arena/Ada%20Bot)");
    expect(screen.getByRole("button", { name: "Copy failed: select the text below" })).toBeTruthy();
  });

  it("copies the badge Markdown when the clipboard accepts it", async () => {
    stub();
    const writeText = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Badge: Connect Four" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(writeText.mock.calls[0][0]).toContain("badge/Ada%20Bot.svg?game=connect4");
  });
});

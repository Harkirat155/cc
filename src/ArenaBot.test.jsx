import React from "react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import ArenaBot from "./ArenaBot";

const ok = (b) => ({ ok: true, json: async () => b });
const games = [{ gameId: "ttt", opponent: "House (easy)", result: "win", ratingAfter: 1216, at: 1 }, { gameId: "connect4", opponent: "guest", result: "loss", ratingAfter: 1190, at: 0 }];
const row = { name: "Ada Bot", rating: 1216, games: 3, wins: 2, draws: 0, losses: 1 };
const board = ok({ games: { ttt: [row], connect4: [{ ...row, rating: 1190, wins: 0, losses: 3 }] } });
const stub = ({ bot = ok({ name: "Ada Bot", games }), live = ok({ games: [] }), lb = board } = {}) => {
  window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? live : String(url).endsWith("/api/arena") ? lb : bot));
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

  it("links a game that has a stored replay and leaves older games without a link", async () => {
    stub({ bot: ok({ name: "Ada Bot", games: [{ ...games[0], replayId: "abc-1" }, games[1]] }) });
    show();
    await screen.findByText(/Won vs House \(easy\)/);
    const links = screen.getAllByRole("link", { name: "Replay" });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/replay/abc-1");
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

  it("still shows the games when only the leaderboard fails", async () => {
    stub({ lb: { ok: false, status: 500 } });
    show();
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
    const field = await screen.findByRole("textbox", { name: "Badge Markdown for Ada Bot, Tic-Tac-Toe" });
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

  it("shows the rating, record and badge per game type from the leaderboard, even with no recent games", async () => {
    stub({ bot: ok({ name: "Ada Bot", games: [] }) });
    show();
    expect(await screen.findByText("No rated games recorded since 2026-11-28")).toBeTruthy();
    expect(screen.getByText("1216 · 3 games · 2W 0D 1L")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Badge: Tic-Tac-Toe" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Badge: Connect Four" })).toBeTruthy();
  });

  it("says plainly when the bot is not rated in any game type", async () => {
    stub({ bot: ok({ name: "Ada Bot", games: [] }), lb: ok({ games: {} }) });
    show();
    expect(await screen.findByText(/not in the top 20 of any game type, so no rating is listed here\./)).toBeTruthy();
  });

  it("never lets a late answer for the previous bot overwrite the current one", async () => {
    const pending = {};
    window.fetch = jest.fn((url) => new Promise((res) => { (pending[String(url)] ??= []).push(res); }));
    render(<MemoryRouter initialEntries={["/arena/Ada%20Bot"]}><Link to="/arena/Grace%20Bot">go</Link><Routes><Route path="/arena/:name" element={<ArenaBot />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "go" }));
    const bot = (n, opp) => ok({ name: n, games: [{ gameId: "ttt", opponent: opp, result: "win", ratingAfter: 1216, at: 1 }] });
    await waitFor(() => expect(pending["/api/arena/Grace%20Bot"]).toHaveLength(1));
    await act(async () => { pending["/api/arena/Grace%20Bot"][0](bot("Grace Bot", "GraceFoe")); pending["/api/arena"].forEach((r) => r(ok({ games: {} }))); });
    await act(async () => { pending["/api/arena/Ada%20Bot"][0](bot("Ada Bot", "AdaFoe")); });
    expect(await screen.findByText(/GraceFoe/)).toBeTruthy();
    expect(screen.queryByText(/AdaFoe/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Grace Bot");
  });

  it("refreshes who is playing every 30 s and drops the line when the refresh fails", async () => {
    jest.useFakeTimers();
    try {
      stub({ live: ok({ games: [{ roomId: "r1", gameId: "ttt", players: ["Ada Bot", "Sam"] }] }) });
      show();
      expect(await screen.findByRole("link", { name: /is in a game · Watch/ })).toBeTruthy();
      window.fetch = jest.fn(async (url) => (String(url).endsWith("/api/live") ? { ok: false, status: 500 } : String(url).endsWith("/api/arena") ? board : ok({ name: "Ada Bot", games })));
      await act(async () => { jest.advanceTimersByTime(30_000); });
      await waitFor(() => expect(screen.queryByRole("link", { name: /is in a game · Watch/ })).toBeNull());
    } finally { jest.useRealTimers(); }
  });

  it("shows no playing-now line on the unregistered state", async () => {
    stub({ bot: { ok: false, status: 404 }, live: ok({ games: [{ roomId: "r1", gameId: "ttt", players: ["Nobody", "Sam"] }] }) });
    show("Nobody");
    await screen.findByText(/No bot named Nobody/);
    expect(screen.queryByText(/Playing now/)).toBeNull();
  });

  it("focuses the heading on arrival and keeps focus in the page when retrying", async () => {
    stub({ bot: { ok: false, status: 500 } });
    show();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    const retry = await screen.findByRole("button", { name: "Try again" });
    retry.focus();
    stub();
    fireEvent.click(retry);
    await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216");
    expect(document.activeElement).not.toBe(document.body);
  });

  it("gives each game type's hand-copy field its own name", async () => {
    stub();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Badge: Tic-Tac-Toe" }));
    fireEvent.click(screen.getByRole("button", { name: "Badge: Connect Four" }));
    expect(await screen.findByRole("textbox", { name: "Badge Markdown for Ada Bot, Connect Four" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Badge Markdown for Ada Bot, Tic-Tac-Toe" })).toBeTruthy();
  });

  it.each(["House%20easy", "H0use-hard", "%20Ada%20Bot", "Ada%20Bot%20"])("gives %s no page and no fetch", (n) => {
    stub();
    show(n);
    expect(screen.getByText(/has no page/)).toBeTruthy();
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it("shows the registered spelling of a lowercase deep link", async () => {
    stub({ live: ok({ games: [{ roomId: "r1", gameId: "ttt", players: ["ada bot", "Sam"] }] }) });
    show("ada%20bot");
    expect(await screen.findByRole("heading", { level: 1, name: "Ada Bot" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "A player named Ada Bot is in a game · Watch" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Badge: Tic-Tac-Toe" }));
  });

  it("says an unlisted test bot is not on the leaderboard", async () => {
    stub({ bot: ok({ name: "Ada Bot", unlisted: true, games }) });
    show();
    expect(await screen.findByText("Unlisted: a test bot, not on the leaderboard")).toBeTruthy();
  });

  it("shows no unlisted note for a listed bot", async () => {
    stub();
    show();
    await screen.findByText("Won vs House (easy) · Tic-Tac-Toe · 1216");
    expect(screen.queryByText(/Unlisted/)).toBeNull();
  });
});

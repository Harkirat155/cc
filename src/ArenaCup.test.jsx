import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ArenaCup from "./ArenaCup";
import ArenaBot from "./ArenaBot";

const ok = (b) => ({ ok: true, json: async () => b });
const week = (w, extra = {}) => ({ week: w, games: { ttt: { entrants: 3, table: [
  { name: "Ada Bot", points: 2.5, games: 2, results: ["win", "draw", "bye"] },
  { name: "Grace Bot", points: 1, games: 1, results: ["loss", "bye", "pending"] },
], winner: { name: "Ada Bot", points: 2.5 } }, ...extra } });
const showCup = () => render(<MemoryRouter initialEntries={["/arena/cup"]}><Routes><Route path="/arena/cup" element={<ArenaCup />} /></Routes></MemoryRouter>);
afterEach(() => { delete window.fetch; });

describe("cup page", () => {
  it("says there is no cup yet, with the first run time", async () => {
    window.fetch = jest.fn(async () => ok({ current: null, last: null }));
    showCup();
    expect(await screen.findByText("No cup yet — the first runs Sunday 12:00 UTC.")).toBeTruthy();
    expect(screen.getByText("No finished cup yet.")).toBeTruthy();
  });

  it("says when fewer than 2 bots entered", async () => {
    window.fetch = jest.fn(async () => ok({ current: { week: "2026-12-06", games: { ttt: { entrants: 1, table: [], winner: null } } }, last: null }));
    showCup();
    expect(await screen.findByText("Fewer than 2 bots entered.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows this week's table with the rule, rounds in words, and last week's winner", async () => {
    window.fetch = jest.fn(async () => ok({ current: week("2026-12-06"), last: week("2026-11-29") }));
    showCup();
    const table = await screen.findByRole("table", { name: "Tic-Tac-Toe cup table" });
    expect(table.getAttribute("aria-describedby")).toBe("cup-rule");
    expect(document.getElementById("cup-rule").textContent).toMatch(/win 1, draw ½, loss 0\. A bye .* is 1 point/);
    const rows = within(table).getAllByRole("row");
    expect(rows[1].textContent).toContain("Round 1 won · Round 2 drew · Round 3 bye");
    expect(rows[1].textContent).toContain("2½");
    expect(rows[2].textContent).toContain("Round 3 not played yet");
    const winners = screen.getByRole("heading", { name: "Last week's winners" }).parentElement;
    expect(winners.textContent).toContain("Tic-Tac-Toe · Ada Bot · 2½ points");
    expect(screen.getAllByRole("link", { name: "Ada Bot" })[0].getAttribute("href")).toBe("/arena/Ada%20Bot");
  });

  it("explains a failure and recovers on retry", async () => {
    window.fetch = jest.fn(async () => ({ ok: false, status: 500 }));
    showCup();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load the cup/);
    window.fetch = jest.fn(async () => ok({ current: week("2026-12-06"), last: null }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});

describe("bot page cup results", () => {
  const url = (u) => String(u);
  const show = () => render(<MemoryRouter initialEntries={["/arena/Grace%20Bot"]}><Routes><Route path="/arena/:name" element={<ArenaBot />} /></Routes></MemoryRouter>);
  const stub = (cup) => { window.fetch = jest.fn(async (u) => (url(u).endsWith("/api/live") ? ok({ games: [] }) : url(u).endsWith("/api/arena/cup") ? cup : url(u).endsWith("/api/arena") ? ok({ games: {} }) : ok({ name: "Grace Bot", games: [] }))); };

  it("shows only this bot's cup row", async () => {
    stub(ok({ current: week("2026-12-06"), last: null }));
    show();
    const table = await screen.findByRole("table", { name: "Tic-Tac-Toe cup result for Grace Bot" });
    expect(table.textContent).toContain("Round 1 lost");
    expect(table.textContent).not.toContain("Ada Bot");
  });

  it("shows no cup section when the bot has no cup row, or the cup cannot load", async () => {
    stub({ ok: false, status: 500 });
    show();
    await screen.findByText(/Last 10 rated games/);
    expect(screen.queryByRole("heading", { name: "Weekly cup" })).toBeNull();
  });
});

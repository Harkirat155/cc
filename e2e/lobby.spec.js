import { test } from "@playwright/test";
import { square, youAre, twoPlayers, expect } from "./helpers.js";

// The seat each frame names: matchFound on the lobby socket, then the Room's ack to joinRoom.
const seats = (page) => {
  const named = {};
  const both = new Promise((resolve) => page.on("websocket", (ws) => ws.on("framereceived", ({ payload }) => {
    const f = JSON.parse(String(payload));
    if (f.t === "matchFound") named.match = f.d.player;
    if (f.t === "ack" && f.d?.player && !named.room) named.room = f.d.player;
    if (named.match && named.room) resolve(named);
  })));
  return both;
};

test("two browsers matched through the lobby hold opposite seats and see each other's move", async ({ browser }) => {
  const [a, b] = await twoPlayers(browser);
  const seated = [a, b].map(seats);
  for (const page of [a, b]) {
    await page.goto("");
    await page.getByRole("button", { name: "Find Match" }).click();
  }
  await Promise.all([a, b].map((p) => p.waitForURL(/\/room\/[A-Z0-9]{5}$/)));
  expect(a.url()).toBe(b.url());

  // The Room seats each browser where matchFound said, and the two seats differ.
  const [sa, sb] = await Promise.all(seated);
  expect(sa.room).toBe(sa.match);
  expect(sb.room).toBe(sb.match);
  expect(new Set([sa.room, sb.room])).toEqual(new Set(["X", "O"]));
  const [x, o] = sa.room === "X" ? [a, b] : [b, a];

  // A click can arrive before the page has applied its seat and is then dropped, so retry until O sees it.
  await expect.poll(async () => {
    await square(x, 2, 2).click({ timeout: 1000 }).catch(() => {});
    return square(o, 2, 2).isDisabled();
  }).toBe(true);
  await expect(youAre(x, "X").first()).toBeVisible();
  await expect(youAre(o, "X")).toHaveCount(0);

  await square(o, 3, 3).click();
  await expect(youAre(o, "O").first()).toBeVisible();
  await expect(square(x, 3, 3)).toBeDisabled(); // X sees O's reply
});

import { test } from "@playwright/test";
import { square, youAre, twoPlayers, expect } from "./helpers.js";

test("two browsers matched through the lobby hold opposite seats and see each other's move", async ({ browser }) => {
  const [a, b] = await twoPlayers(browser);
  for (const page of [a, b]) {
    await page.goto("");
    await page.getByRole("button", { name: "Find Match" }).click();
  }
  await Promise.all([a, b].map((p) => p.waitForURL(/\/room\/[A-Z0-9]{5}$/)));
  expect(a.url()).toBe(b.url());

  // Both try to open; the server accepts only the seat that matchFound named X.
  await Promise.all([square(a, 2, 2).click(), square(b, 1, 1).click()]);
  await expect.poll(async () => (await youAre(a, "X").count()) + (await youAre(b, "X").count())).toBe(1);
  const [x, o] = (await youAre(a, "X").count()) ? [a, b] : [b, a];
  await expect(youAre(o, "X")).toHaveCount(0);

  const taken = x === a ? [2, 2] : [1, 1];
  await expect(square(o, ...taken)).toBeDisabled(); // O sees X's move
  await square(o, 3, 3).click();
  await expect(youAre(o, "O").first()).toBeVisible();
  await expect(square(x, 3, 3)).toBeDisabled(); // X sees O's reply
});

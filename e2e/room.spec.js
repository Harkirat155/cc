import { test } from "@playwright/test";
import { square, youAre, twoPlayers, expect } from "./helpers.js";

test("create a room, join by code, X wins the top row, both see it", async ({ browser }) => {
  const [a, b] = await twoPlayers(browser);
  await a.goto("");
  await a.getByRole("button", { name: "Create Match" }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{5}$/);
  const code = a.url().split("/").pop();

  await b.goto(`room/${code}`);

  // X: 0,1,2 on the top row; O: 3,4 in between.
  await square(a, 1, 1).click();
  await expect(square(b, 1, 1)).toBeDisabled();
  await expect(youAre(a, "X").first()).toBeVisible();
  await expect(youAre(b, "X")).toHaveCount(0);
  await square(b, 2, 1).click();
  await expect(youAre(b, "O").first()).toBeVisible();
  await square(a, 1, 2).click();
  await square(b, 2, 2).click();
  await square(a, 1, 3).click();

  for (const page of [a, b]) {
    await expect(page.getByLabel(/^Player X score/)).toContainText("1");
    await expect(page.getByText(/wins|won/i).first()).toBeVisible();
  }
});

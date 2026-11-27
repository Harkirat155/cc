import { expect } from "@playwright/test";

export const square = (page, row, col) => page.getByRole("button", { name: new RegExp(`^Square row ${row}, column ${col}`) });

// The timeline labels an X entry "You (X)" on the browser that holds seat X and "Player X" on the other.
// The score card's "You" badge (inside the "Edit <label> name" button) shows on the card whose roster id is socket.id.
export const youAre = (page, mark) => page.getByText(`You (${mark})`);

export const youBadge = (page) => page.getByRole("button", { name: /^Edit .* name$/ }).getByText("You", { exact: true });

export async function twoPlayers(browser) {
  const pages = [];
  for (let i = 0; i < 2; i++) pages.push(await (await browser.newContext()).newPage());
  return pages;
}

export { expect };

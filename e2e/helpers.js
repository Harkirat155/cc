import { expect } from "@playwright/test";

export const square = (page, row, col) => page.getByRole("button", { name: new RegExp(`^Square row ${row}, column ${col}`) });

// The timeline labels an X entry "You (X)" on the browser that holds seat X and "Player X" on the other.
// (The score cards' "You" badge compares roster ids to socket.id, which the shim does not yet set to the Room's id.)
export const youAre = (page, mark) => page.getByText(`You (${mark})`);

export async function twoPlayers(browser) {
  const pages = [];
  for (let i = 0; i < 2; i++) pages.push(await (await browser.newContext()).newPage());
  return pages;
}

export { expect };

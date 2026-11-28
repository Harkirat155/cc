// Pure date and grid helpers for the daily archive. Dates are UTC "YYYY-MM-DD", months "YYYY-MM".

/** Months from the launch day's month to today's, newest first. */
export function monthsBetween(first, today) {
  const out = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` >= first.slice(0, 7)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

/** Weeks of 7 cells, Monday first: a date, or null for padding outside the month. */
export function monthWeeks(ym) {
  const [y, m] = ym.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** "solved" (in days), "tried" (past tries, or more than the first try on the latest day), else "not tried". */
export function dayState(date, store) {
  if (store.days?.includes(date)) return "solved";
  if (store.pastTries?.[date] || (store.date === date && store.tries > 1)) return "tried";
  return "not tried";
}

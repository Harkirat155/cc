// Weekly Arena cup pairing (docs/arena.md). Pure and deterministic: the same entrants give the same rounds.
export type Entrant = { lc: string; rating: number };
export type Pair = { a: string; b: string | null }; // b null = a bye

export const CUP_ROUNDS = 3;

// Swiss-style by rating: each round pairs the highest unpaired bot with the nearest-rated bot it has not met yet
// (a repeat only when no full round of new pairings exists). An odd count gives the lowest-rated bot without a bye yet the bye.
// Pairings are fixed up front from the rating snapshot, not from cup results (the rounds are played by the bots' own rated games).
export function pairRounds(entrants: Entrant[], rounds = CUP_ROUNDS): Pair[][] {
  if (entrants.length < 2) return [];
  const sorted = [...entrants].sort((x, y) => y.rating - x.rating || (x.lc < y.lc ? -1 : x.lc > y.lc ? 1 : 0)).map((e) => e.lc);
  const met = new Set<string>();
  const byes = new Set<string>();
  const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const out: Pair[][] = [];
  for (let r = 0; r < rounds; r++) {
    const pool = [...sorted];
    const round: Pair[] = [];
    let bye: string | null = null;
    if (pool.length % 2) {
      bye = [...pool].reverse().find((n) => !byes.has(n)) ?? pool[pool.length - 1];
      byes.add(bye);
      pool.splice(pool.indexOf(bye), 1);
    }
    // Nearest-rated first, backtracking so no one is left holding only a repeat; if the search runs out of budget, repeat the nearest.
    let budget = 5000;
    const match = (rest: string[], allowRepeat: boolean): [string, string][] | null => {
      if (!rest.length) return [];
      if (--budget < 0) return null;
      const [x, ...others] = rest;
      for (let i = 0; i < others.length; i++) {
        if (!allowRepeat && met.has(key(x, others[i]))) continue;
        const tail = match(others.filter((_, j) => j !== i), allowRepeat);
        if (tail) return [[x, others[i]], ...tail];
      }
      return null;
    };
    const found = match(pool, false) ?? ((budget = 5000), match(pool, true)) ?? [];
    for (const [x, y] of found) {
      met.add(key(x, y));
      round.push({ a: x, b: y });
    }
    if (bye) round.push({ a: bye, b: null });
    out.push(round);
  }
  return out;
}

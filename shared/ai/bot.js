// Generic computer opponent over the GameRules contract (rules.js / types.js).
// Uses only getLegalMoves / applyMove / checkTerminal plus the optional
// rules.evaluate(state, slot) heuristic; applyMove is immutable so search
// never touches the input state.

export const LEVELS = ['easy', 'medium', 'hard'];

const WIN = 100000;
const HARD_TIME_MS = 300;
const HARD_NODE_CAP = 200000;
const MAX_DEPTH = 64;
const WIDE_BOARD_MOVES = 40;
const WIDE_BOARD_KEEP = 20;
const MEDIUM_NOISE = 3;

class Abort extends Error {}

const heuristic = (rules, state, slot) =>
  typeof rules.evaluate === 'function' ? rules.evaluate(state, slot) : 0;

function winnerOf(rules, state) {
  const t = rules.checkTerminal(state);
  return t.status === 'active' ? undefined : t.status === 'win' ? t.winner : null;
}

function orderedMoves(rules, state, mover) {
  const moves = rules.getLegalMoves(state, mover);
  const wide = moves.length > WIDE_BOARD_MOVES;
  if (moves.length < 2 || (!wide && typeof rules.evaluate !== 'function')) return moves;
  const scored = moves.map((move) => {
    const child = rules.applyMove(state, move, mover).state;
    const w = winnerOf(rules, child);
    const score = w === mover ? WIN : w === null ? 0 : heuristic(rules, child, mover);
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return (wide ? scored.slice(0, WIDE_BOARD_KEEP) : scored).map((s) => s.move);
}

function createSearch(rules, deadline, nodeCap) {
  const ctx = { nodes: 0, cut: false };

  // Value of `state` for state.turn, negamax with alpha-beta.
  function negamax(state, depth, alpha, beta, ply) {
    if (++ctx.nodes > nodeCap || ((ctx.nodes & 255) === 0 && Date.now() > deadline)) throw new Abort();
    const mover = state.turn;
    if (depth === 0) {
      ctx.cut = true;
      return heuristic(rules, state, mover);
    }
    const moves = orderedMoves(rules, state, mover);
    if (moves.length === 0) return 0;
    let best = -Infinity;
    for (const move of moves) {
      const child = rules.applyMove(state, move, mover).state;
      const w = winnerOf(rules, child);
      let v;
      if (w === undefined) {
        v = child.turn === mover
          ? negamax(child, depth - 1, alpha, beta, ply + 1)
          : -negamax(child, depth - 1, -beta, -alpha, ply + 1);
      } else {
        v = w === mover ? WIN - ply : w === null ? 0 : -(WIN - ply);
      }
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Scores every root move at `depth`; returns [{move, score}].
  function searchRoot(state, slot, moves, depth, noise, rng) {
    const out = [];
    let best = -Infinity;
    for (const move of moves) {
      const child = rules.applyMove(state, move, slot).state;
      const w = winnerOf(rules, child);
      let v;
      if (w !== undefined) v = w === slot ? WIN : w === null ? 0 : -WIN;
      else {
        // Window (best - 1, inf): ties with the best stay exact, so equal moves can be picked at random.
        const alpha = best === -Infinity || noise ? -Infinity : best - 1;
        v = child.turn === slot
          ? negamax(child, depth - 1, alpha, Infinity, 1)
          : -negamax(child, depth - 1, -Infinity, -alpha, 1);
        if (noise) v += rng() * noise;
      }
      out.push({ move, score: v });
      if (v > best) best = v;
    }
    return out;
  }

  return { ctx, searchRoot };
}

const pickRandom = (items, rng) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

function pickBest(scored, rng) {
  const top = Math.max(...scored.map((s) => s.score));
  return pickRandom(scored.filter((s) => s.score > top - 1), rng).move;
}

/**
 * @param {import('../games/rules.js').GameRules} rules
 * @param {import('../games/types.js').GameState} state
 * @param {import('../games/types.js').Slot} slot
 * @param {'easy'|'medium'|'hard'} level
 * @param {() => number} [rng]
 * @returns {import('../games/types.js').Move | null}
 */
export function chooseMove(rules, state, slot, level, rng = Math.random) {
  const all = rules.getLegalMoves(state, slot);
  if (all.length === 0) return null;
  if (all.length === 1) return all[0];

  const winning = all.find((m) => winnerOf(rules, rules.applyMove(state, m, slot).state) === slot);
  if (winning) return winning;
  if (level === 'easy') return pickRandom(all, rng);

  const moves = orderedMoves(rules, state, slot);
  if (level === 'medium') {
    const { searchRoot } = createSearch(rules, Infinity, Infinity);
    return pickBest(searchRoot(state, slot, moves, 2, MEDIUM_NOISE, rng), rng);
  }

  const { ctx, searchRoot } = createSearch(rules, Date.now() + HARD_TIME_MS, HARD_NODE_CAP);
  let best = moves[0];
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    ctx.cut = false;
    let scored;
    try {
      scored = searchRoot(state, slot, moves, depth, 0, rng);
    } catch (e) {
      if (e instanceof Abort) break;
      throw e;
    }
    best = pickBest(scored, rng);
    const top = Math.max(...scored.map((s) => s.score));
    if (!ctx.cut || Math.abs(top) > WIN / 2) break;
  }
  return best;
}

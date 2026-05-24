// GameRules contract — every game module must export an object matching this shape.
// See ./types.js for typedefs.

/**
 * @typedef {Object} GameRules
 * @property {string}   id            Short slug ('ttt', 'connect4', 'checkers').
 * @property {string}   displayName   Human-readable name shown in UI.
 * @property {2}        players       Two-player platform; reserved for future expansion.
 * @property {import('./types.js').Player[]} playerInfo
 *           Per-slot metadata (labels, colors). Index = slot.
 * @property {import('./types.js').BoardSpec} boardSpec
 *           Static board shape; used by the renderer.
 *
 * @property {() => import('./types.js').GameState} createInitialState
 *           Returns a fresh, immutable initial state. Scores reset to [0,0].
 *
 * @property {(state: import('./types.js').GameState, slot: import('./types.js').Slot, from?: number)
 *            => import('./types.js').Move[]} getLegalMoves
 *           All legal moves for `slot` from `state`. For piece-movement games
 *           the optional `from` narrows to moves originating at that cell
 *           (used for click-to-select UI highlighting).
 *
 * @property {(state: import('./types.js').GameState, move: import('./types.js').Move, slot: import('./types.js').Slot)
 *            => import('./types.js').ApplyMoveResult} applyMove
 *           Returns a NEW state (immutable). Must NOT mutate the input.
 *           Increments moveCount, flips turn (unless terminal), and updates
 *           scores/status when the move ends the game.
 *
 * @property {(state: import('./types.js').GameState)
 *            => import('./types.js').TerminalResult} checkTerminal
 *           Pure inspection — does not mutate state.
 *
 * @property {(move: import('./types.js').Move, rules: GameRules) => string} describeMove
 *           Short human string for the history panel.
 */

/**
 * Lightweight runtime check that an object satisfies the GameRules contract.
 * Throws with a precise reason on the first missing field — registry.register()
 * calls this so misconfigured games fail loudly at startup, not mid-game.
 *
 * @param {unknown} rules
 * @returns {GameRules}
 */
export function assertGameRules(rules) {
  if (!rules || typeof rules !== 'object') {
    throw new TypeError('GameRules must be an object');
  }
  const required = [
    'id', 'displayName', 'players', 'playerInfo', 'boardSpec',
    'createInitialState', 'getLegalMoves', 'applyMove', 'checkTerminal', 'describeMove',
  ];
  for (const key of required) {
    if (!(key in rules)) {
      throw new TypeError(`GameRules missing required field: ${key}`);
    }
  }
  const r = /** @type {GameRules} */ (rules);
  if (typeof r.id !== 'string' || !r.id) throw new TypeError('GameRules.id must be a non-empty string');
  if (r.players !== 2) throw new TypeError('GameRules.players must be 2');
  if (!Array.isArray(r.playerInfo) || r.playerInfo.length !== 2) {
    throw new TypeError('GameRules.playerInfo must be an array of length 2');
  }
  return r;
}

// Game registry. Server and client both import from here.
// Games register themselves by id; lookups throw on unknown ids to surface
// bugs early (instead of silently falling through to a default).

import { assertGameRules } from './rules.js';

/** @type {Map<string, import('./rules.js').GameRules>} */
const games = new Map();

/**
 * Register a GameRules implementation. Idempotent — re-registering the same
 * id replaces the prior entry (useful during HMR / test setup).
 * @param {import('./rules.js').GameRules} rules
 */
export function register(rules) {
  const validated = assertGameRules(rules);
  games.set(validated.id, validated);
  return validated;
}

/**
 * @param {string} id
 * @returns {import('./rules.js').GameRules}
 */
export function get(id) {
  const rules = games.get(id);
  if (!rules) {
    throw new Error(`Unknown game id: ${id}. Known: ${[...games.keys()].join(', ') || '(none registered)'}`);
  }
  return rules;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function has(id) {
  return games.has(id);
}

/**
 * @returns {string[]} Registered game ids.
 */
export function listIds() {
  return [...games.keys()];
}

/**
 * @returns {import('./rules.js').GameRules[]} Registered rules modules.
 */
export function listAll() {
  return [...games.values()];
}

// Test-only — not part of the public surface, but tests need a clean slate.
export function _resetForTests() {
  games.clear();
}

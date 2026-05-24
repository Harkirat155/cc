import { register, get, has, listIds, _resetForTests } from '../registry.js';
import { assertGameRules } from '../rules.js';
import ttt from '../ttt.js';

describe('shared/games/registry', () => {
  beforeEach(() => _resetForTests());

  test('register + get round-trip', () => {
    register(ttt);
    expect(has('ttt')).toBe(true);
    expect(get('ttt')).toBe(ttt);
    expect(listIds()).toEqual(['ttt']);
  });

  test('get throws on unknown id', () => {
    expect(() => get('nope')).toThrow(/Unknown game id/);
  });

  test('register is idempotent (replaces same id)', () => {
    register(ttt);
    register(ttt);
    expect(listIds()).toEqual(['ttt']);
  });

  test('register rejects malformed rules', () => {
    expect(() => register(/** @type {any} */ ({}))).toThrow(/missing required field/);
    expect(() => register(/** @type {any} */ (null))).toThrow(/must be an object/);
  });
});

describe('shared/games/rules — assertGameRules', () => {
  test('accepts a well-formed rules object', () => {
    expect(() => assertGameRules(ttt)).not.toThrow();
  });

  test('rejects players !== 2', () => {
    expect(() => assertGameRules({ ...ttt, players: 3 })).toThrow(/players must be 2/);
  });

  test('rejects empty id', () => {
    expect(() => assertGameRules({ ...ttt, id: '' })).toThrow(/non-empty string/);
  });

  test('rejects bad playerInfo', () => {
    expect(() => assertGameRules({ ...ttt, playerInfo: [ttt.playerInfo[0]] })).toThrow(/length 2/);
  });
});

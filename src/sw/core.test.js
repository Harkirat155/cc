/** @jest-environment node */
import { cacheName, staleCaches, routeFor, fallbackKeys, buildAssetList, activateCleanup, shellFor } from './core.js';

const ctx = { origin: 'https://harkirat155.github.io', base: '/cc/', precache: new Set(['/cc/index.html', '/cc/assets/a-1.js', '/cc/icons/icon-192x192.svg']) };
const req = (path, extra = {}) => ({ method: 'GET', mode: 'no-cors', url: `https://harkirat155.github.io${path}`, ...extra });

describe('cacheName / staleCaches', () => {
  test('names a cache by version', () => expect(cacheName('abc')).toBe('cc-shell-abc'));
  test('stale = our older caches only, never the current or foreign ones', () => {
    expect(staleCaches(['cc-shell-old', 'cc-shell-new', 'other-app', 'cc-shell-older'], 'cc-shell-new')).toEqual(['cc-shell-old', 'cc-shell-older']);
  });
});

describe('routeFor', () => {
  test('navigation inside the scope is network-first', () => {
    expect(routeFor(req('/cc/daily', { mode: 'navigate' }), ctx)).toBe('navigate');
    expect(routeFor(req('/cc/', { mode: 'navigate' }), ctx)).toBe('navigate');
  });
  test('precached files are cache-first', () => {
    expect(routeFor(req('/cc/assets/a-1.js'), ctx)).toBe('asset');
    expect(routeFor(req('/cc/icons/icon-192x192.svg'), ctx)).toBe('asset');
  });
  test('unlisted same-origin files go to the network', () => {
    expect(routeFor(req('/cc/assets/unknown.js'), ctx)).toBe('network');
  });
  test('never touches api, socket, tally, cross-origin, non-GET or out-of-scope requests', () => {
    expect(routeFor(req('/cc/api/live', { mode: 'navigate' }), ctx)).toBe('network');
    expect(routeFor(req('/cc/socket.io/?x=1'), ctx)).toBe('network');
    expect(routeFor(req('/cc/ws'), ctx)).toBe('network');
    expect(routeFor(req('/cc/tally'), ctx)).toBe('network');
    expect(routeFor({ ...req('/cc/assets/a-1.js'), url: 'https://cc-api.example.workers.dev/cc/assets/a-1.js' }, ctx)).toBe('network');
    expect(routeFor(req('/cc/assets/a-1.js', { method: 'POST' }), ctx)).toBe('network');
    expect(routeFor(req('/other', { mode: 'navigate' }), ctx)).toBe('network');
  });
});

describe('fallbackKeys', () => {
  test('a prerendered route first, then the app shell', () => {
    expect(fallbackKeys('/cc/daily', '/cc/')).toEqual(['/cc/daily/index.html', '/cc/index.html']);
    expect(fallbackKeys('/cc/daily/', '/cc/')).toEqual(['/cc/daily/index.html', '/cc/index.html']);
    expect(fallbackKeys('/cc/', '/cc/')).toEqual(['/cc/index.html']);
    expect(fallbackKeys('/cc/room/ABC', '/cc/')).toEqual(['/cc/room/ABC/index.html', '/cc/index.html']);
  });
});

describe('buildAssetList', () => {
  test('lists the app shell under the base, sorted, without the worker, maps, 404 or social cards', () => {
    const files = ['index.html', 'sw.js', 'assets/b.js', 'assets/a.css', 'assets/a.js.map', '404.html', 'og-daily.png', 'robots.txt', 'daily/index.html', 'icons/icon-192x192.svg', 'manifest.json'];
    expect(buildAssetList(files, '/cc/')).toEqual([
      '/cc/assets/a.css', '/cc/assets/b.js', '/cc/daily/index.html', '/cc/icons/icon-192x192.svg', '/cc/index.html', '/cc/manifest.json',
    ]);
  });
});

// A tiny CacheStorage: { name: { key: body } }.
const fakeCaches = (data) => ({
  keys: async () => Object.keys(data),
  delete: async (n) => delete data[n],
  open: async (n) => ({ match: async (k) => (data[n] && data[n][k]) || undefined }),
});

describe('activateCleanup', () => {
  test('deletes only our older caches, keeps the current and foreign ones', async () => {
    const data = { 'cc-shell-old': {}, 'cc-shell-new': {}, 'other-app': {} };
    await activateCleanup(fakeCaches(data), 'cc-shell-new');
    expect(Object.keys(data)).toEqual(['cc-shell-new', 'other-app']);
  });
});

describe('shellFor', () => {
  test('answers from the current version only, never an older shell', async () => {
    const data = { 'cc-shell-old': { '/cc/index.html': 'OLD' }, 'cc-shell-new': { '/cc/index.html': 'NEW', '/cc/daily/index.html': 'DAILY' } };
    const c = fakeCaches(data);
    expect(await shellFor(c, 'cc-shell-new', '/cc/daily', '/cc/')).toBe('DAILY');
    expect(await shellFor(c, 'cc-shell-new', '/cc/room/X', '/cc/')).toBe('NEW');
    expect(await shellFor(fakeCaches({ 'cc-shell-old': { '/cc/index.html': 'OLD' }, 'cc-shell-new': {} }), 'cc-shell-new', '/cc/', '/cc/')).toBeUndefined();
  });
});

/** @jest-environment node */
import { cacheName, staleCaches, routeFor, fallbackKeys, buildAssetList } from './core.js';

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

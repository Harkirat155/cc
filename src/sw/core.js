/* global URL */
// Pure decisions for the service worker (public/ of the build gets sw.js bundled from worker.js + this file).
export const CACHE_PREFIX = 'cc-shell-';
export const cacheName = (version) => `${CACHE_PREFIX}${version}`;

// Our caches from older versions; run only after the new one is fully installed.
export const staleCaches = (names, current) => names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);

const LIVE_PATH = /^\/(?:api|ws|socket\.io|tally)(?:\/|$)/;

// 'navigate' (network first, shell as fallback), 'asset' (cache first) or 'network' (not ours: leave it alone).
export function routeFor({ method, mode, url }, { origin, base, precache }) {
  if (method !== 'GET') return 'network';
  const u = new URL(url);
  if (u.origin !== origin || !u.pathname.startsWith(base)) return 'network';
  if (LIVE_PATH.test(u.pathname.slice(base.length - 1))) return 'network';
  if (mode === 'navigate') return 'navigate';
  return precache.has(u.pathname) ? 'asset' : 'network';
}

// Cached pages to try, in order, when a navigation cannot reach the network.
export function fallbackKeys(pathname, base) {
  const shell = `${base}index.html`;
  if (pathname === base || pathname === shell) return [shell];
  return [`${pathname.replace(/\/$/, '')}/index.html`, shell];
}

const SKIP = /(^|\/)(sw\.js|404\.html|robots\.txt|sitemap\.xml|llms\.txt|agent-manifest\.json|og-[^/]*\.png)$|\.map$/;

// Files of the build output (relative, posix) to keep on the phone, as absolute URLs under base.
export const buildAssetList = (files, base) =>
  files.filter((f) => !SKIP.test(f)).map((f) => `${base}${f}`).sort();

// Delete our older caches. Runs on activate, which (without skipWaiting) happens only once no page uses the old worker.
export const activateCleanup = async (cacheStorage, current) =>
  Promise.all(staleCaches(await cacheStorage.keys(), current).map((n) => cacheStorage.delete(n)));

// The cached page for an offline navigation, from the current version's cache only.
export async function shellFor(cacheStorage, current, pathname, base) {
  const cache = await cacheStorage.open(current);
  for (const key of fallbackKeys(pathname, base)) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  return undefined;
}

// Kill switch activation: drop our caches, take over open pages (navigate only works on controlled ones), unregister,
// then reload those pages from the network.
export async function killActivate({ caches, clients, registration }) {
  await activateCleanup(caches, null);
  await clients.claim();
  const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  await registration.unregister();
  await Promise.all(wins.map((c) => c.navigate(c.url).catch(() => {})));
}

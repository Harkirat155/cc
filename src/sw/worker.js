/* global self, caches, Request, Response, fetch, URL */
/* global __VERSION__, __BASE__, __PRECACHE__ */
import { cacheName, staleCaches, routeFor, fallbackKeys } from './core.js';

// Replaced at build time by scripts/swBuild.js.
const VERSION = __VERSION__;
const BASE = __BASE__;
const PRECACHE = __PRECACHE__;
const CURRENT = cacheName(VERSION);
const precache = new Set(PRECACHE);

// Install fills the new cache completely (addAll fails as a whole), so a half-cached version never takes over.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Old versions are deleted here, which only runs after this version's install succeeded.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(staleCaches(names, CURRENT).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const fromShell = async (pathname) => {
  const cache = await caches.open(CURRENT);
  for (const key of fallbackKeys(pathname, BASE)) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  return Response.error();
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const route = routeFor(request, { origin: self.location.origin, base: BASE, precache });
  if (route === 'navigate') {
    event.respondWith(fetch(request).catch(() => fromShell(new URL(request.url).pathname)));
  } else if (route === 'asset') {
    event.respondWith(caches.open(CURRENT).then((c) => c.match(new URL(request.url).pathname)).then((hit) => hit || fetch(request)));
  }
});

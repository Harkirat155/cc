/* global self, caches, Request, Response, fetch, URL */
/* global __VERSION__, __BASE__, __PRECACHE__ */
import { cacheName, routeFor, activateCleanup, shellFor } from './core.js';

// Replaced at build time by scripts/swBuild.js.
const VERSION = __VERSION__;
const BASE = __BASE__;
const PRECACHE = __PRECACHE__;
const CURRENT = cacheName(VERSION);
const precache = new Set(PRECACHE);

// Install fills the new cache completely (addAll fails as a whole), so a half-cached version never takes over.
// No skipWaiting: an update waits until every tab on the old version is closed, so an open old page keeps its own chunks.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

// Runs only after install succeeded and no old page is left. No clients.claim: pages already open stay as they are.
self.addEventListener('activate', (event) => {
  event.waitUntil(activateCleanup(caches, CURRENT));
});

const fromShell = async (pathname) => (await shellFor(caches, CURRENT, pathname, BASE)) || Response.error();

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const route = routeFor(request, { origin: self.location.origin, base: BASE, precache });
  if (route === 'navigate') {
    event.respondWith(fetch(request).catch(() => fromShell(new URL(request.url).pathname)));
  } else if (route === 'asset') {
    event.respondWith(caches.open(CURRENT).then((c) => c.match(new URL(request.url).pathname)).then((hit) => hit || fetch(request)));
  }
});

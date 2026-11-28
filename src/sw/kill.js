/* global self, caches */
// Kill switch (CC_SW_KILL=1 npm run build emits this as sw.js): a browser that has the offline worker picks this up on its
// next visit, deletes every cc-shell-* cache, unregisters itself and reloads its pages from the network.
import { CACHE_PREFIX } from './core.js';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});

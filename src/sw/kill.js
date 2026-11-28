/* global self, caches */
// Kill switch (CC_SW_KILL=1 npm run build emits this as sw.js): a browser that has the offline worker picks this up on its
// next visit, deletes every cc-shell-* cache, unregisters itself and reloads its pages from the network.
import { killActivate } from './core.js';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(killActivate({ caches, clients: self.clients, registration: self.registration }));
});

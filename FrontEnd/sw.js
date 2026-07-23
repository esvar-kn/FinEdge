/**
 * FinEdge service worker — deliberately minimal.
 *
 * It exists to make the app installable (PWA) but intentionally does NOT cache
 * responses: a finance app must always show live data, and a stale cache of
 * balances or transactions would be worse than useless. Every request goes
 * straight to the network. Add offline caching of the static shell later if
 * desired — but never cache /api/ responses.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

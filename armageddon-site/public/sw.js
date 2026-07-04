/*
 * Service worker kill switch.
 *
 * A previous production build registered a Workbox service worker at /sw.js.
 * That worker was removed from the codebase, but the static edge serves the
 * SPA fallback (HTML, status 200) for unknown paths, so browsers holding the
 * old registration could never update it — the stale worker kept intercepting
 * fetches (Cloudflare Insights beacon failures, precache hosts that no longer
 * resolve). This file MUST keep being served at /sw.js so returning clients
 * pick it up on their next update check, unregister, and drop all caches.
 *
 * Do not add a fetch handler here: requests must pass through to the network.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windowClients = await self.clients.matchAll({ type: 'window' });
      for (const client of windowClients) {
        client.navigate(client.url);
      }
    })(),
  );
});

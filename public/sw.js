/*
 * Minimal static-shell service worker.
 *
 * Its only job is to make PowerPulse reliably installable and to serve the
 * build's immutable, content-hashed assets from cache. It deliberately does
 * NOT touch:
 *   - anything cross-origin: Firestore, Firebase Auth, map tiles, fonts
 *   - HTML documents, so a new deployment is picked up immediately
 *   - any request that is not a GET
 *
 * No community report data, no authentication traffic and no map tiles are
 * ever stored here.
 */

const CACHE = 'powerpulse-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same origin only, and only the hashed build output under /assets/.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.includes('/assets/')) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      // Hashed filenames change on every deploy, so a hit is always current.
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});

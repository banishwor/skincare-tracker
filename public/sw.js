// The version placeholder in the cache name below is replaced with the
// package version at build time (see the stamp-sw-version plugin in
// vite.config.ts), so every release produces a byte-different sw.js and
// the browser registers the update — the waiting-worker → in-app banner
// flow depends on it.
const CACHE_NAME = 'skin-routine-pwa-__APP_VERSION__';

// Dynamically compute the base path where this service worker is located (supports GitHub Pages subpaths!)
const BASE_PATH = self.location.pathname.substring(
  0,
  self.location.pathname.lastIndexOf('/') + 1
);

const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icon-192.png',
  BASE_PATH + 'icon-512.png',
  BASE_PATH + 'icon.svg'
];

self.addEventListener('install', (event) => {
  // Do NOT skipWaiting automatically: when a previous version is running,
  // this worker waits until the user accepts the in-app update prompt
  // (which posts SKIP_WAITING), so nobody is reloaded mid-routine.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => {
        console.warn('SW pre-cache warning, proceeding with network fallback', err);
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Cache-first with network fill for assets; navigation falls back to the cached shell offline.
  // Note: only the app shell is cached here — user data lives in IndexedDB and is never cached.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(BASE_PATH + 'index.html') || caches.match(BASE_PATH);
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

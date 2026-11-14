// Service worker: caches the app shell so the app opens offline.
//
// RELEASES: VERSION ends with a hash of the files in SHELL. After changing
// any of them, run `node tools/sw-version.js --write` (`node --test` fails
// until you do). A changed sw.js is what makes browsers install the new
// version; the page then shows "Hay una versión nueva" and the user reloads
// into it.

const VERSION = 'v1-13a61b19';
const CACHE = `qch-shell-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/dishes.js',
  './js/group.js',
  './js/nutrition.js',
  './js/params.js',
  './js/recipes.js',
  './js/scoring.js',
  './js/state.js',
  './js/storage.js',
  './js/strings.js',
  './js/wheel.js',
  './js/wheel-view.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so a new version never precaches stale files.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('qch-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page sends this when the user taps "Recargar" on the update banner.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (err) {
        // Offline navigation to any URL in scope: serve the app.
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        throw err;
      }
    }),
  );
});

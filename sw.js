const VERSION = '1.1.1-mobile-layout';
const SHELL_CACHE = `eldoria-shell-${VERSION}`;
const RUNTIME_CACHE = `eldoria-runtime-${VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './simulation-worker.js',
  './src/main.js',
  './src/audio.js',
  './src/data.js',
  './src/engine.js',
  './src/memory-content.js',
  './src/memory-systems.js',
  './src/memory-ui.js',
  './src/state.js',
  './src/storage.js',
  './src/supabase-adapter.js',
  './src/ui.js',
  './src/utils.js',
  './assets/eldoria-map.png',
  './assets/screenshot-wide.png',
  './assets/screenshot-map.png',
  './assets/screenshot-mobile.png',
  './assets/icons/icon-64.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/ui/sprite.svg',
  './assets/audio/click.wav',
  './assets/audio/hit.wav',
  './assets/audio/hurt.wav',
  './assets/audio/miss.wav',
  './assets/audio/objective.wav',
  './assets/audio/quest.wav',
  './assets/audio/quest-complete.wav',
  './assets/audio/victory.wav',
  './assets/audio/rare.wav',
  './assets/audio/save.wav',
];

self.addEventListener('install', (event) => {
  // Do not call skipWaiting here. The running app creates a recovery snapshot
  // and explicitly authorizes activation from its update banner.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('eldoria-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match('./index.html'))
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then(async (response) => {
    if (response?.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

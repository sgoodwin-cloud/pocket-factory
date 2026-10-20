// Offline caching. Bump VERSION whenever any file changes so phones pick up the update.
const VERSION = 'pf-v0.2.1';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/sim.js',
  './js/render.js',
  './js/input.js',
  './js/levels.js',
  './js/ui.js',
  './js/save.js',
  './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/ibm-plex-mono-latin-400-normal.woff2',
  './fonts/ibm-plex-mono-latin-500-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first, falling back to the network; the page itself falls back to the cached index.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});

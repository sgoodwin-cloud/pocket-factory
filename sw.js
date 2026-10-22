// Bump VERSION whenever the game changes, together with APP_VERSION in js/main.js: the number after
// 'pocket-factory-v' must equal APP_VERSION, or installs fail on purpose (see install below).
const VERSION = 'pocket-factory-v9';
// Every file the game needs offline. Add any new file here.
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/sim.js',
  './js/render.js',
  './js/input.js',
  './js/levels.js',
  './js/layout.js',
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

// Install: fetch every file fresh and store it under its plain address.
// - cache: 'reload' skips the phone's own web cache.
// - ?v=<VERSION> makes each address new to GitHub Pages' CDN, which can otherwise serve the
//   previous version's files for a few minutes after a deploy (that left v5 files inside v6).
// - Check js/main.js really is this version. If not (e.g. just after a deploy, before GitHub has
//   finished publishing), wait and try again with a fresh address, up to 4 times; only then fail.
//   A failed install can leave an iPhone refusing to retry the same sw.js (Flip 7 v4).
const APP_VERSION = VERSION.replace('pocket-factory-v', '');
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 3000 * attempt));
      try {
        const c = await caches.open(VERSION);
        await Promise.all(CORE.map(async u => {
          const res = await fetch(new Request(`${u}?v=${VERSION}&try=${attempt}`, { cache: 'reload' }));
          if (!res.ok) throw new Error(`${u}: ${res.status}`);
          await c.put(u, res);
        }));
        const marker = await (await c.match('./js/main.js')).text();
        if (marker.includes(`APP_VERSION = '${APP_VERSION}'`)) return;
      } catch (err) { /* network hiccup: try again */ }
      await caches.delete(VERSION);
    }
    throw new Error('could not fetch this version\'s files; will retry on the next update check');
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page's "Update ready" banner sends this when tapped.
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Cache first; fall back to the game page when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

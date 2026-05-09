const VERSION = '2026-05-09-v3';
const STATIC_CACHE = `tab-static-${VERSION}`;
const RUNTIME_CACHE = `tab-runtime-${VERSION}`;
const TRIP_CACHE = `tab-trips-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/styles.css?v=18',
  '/app.js?v=22',
  '/manifest.webmanifest',
  '/favicon.png',
  '/assets/thereandback-logo.png',
  '/trips/index.json',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://fonts.googleapis.com/css2?family=Caprasimo&family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Work+Sans:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(cacheEach(STATIC_CACHE, SHELL_URLS).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE, TRIP_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map(name => keep.has(name) ? null : caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type !== 'SAVE_TRIP') return;
  const port = event.ports && event.ports[0];
  event.waitUntil((async () => {
    try {
      const tripId = event.data.tripId;
      if (!tripId) throw new Error('Missing trip id.');
      const encoded = encodeURIComponent(tripId);
      const urls = [
        ...SHELL_URLS,
        `/api/trips/${encoded}`,
        `/trips/${encoded}.csv`,
        '/trips/index.json',
        event.data.url || '/'
      ];
      const count = await cacheEach(TRIP_CACHE, urls);
      port?.postMessage({ ok: true, count });
    } catch (err) {
      port?.postMessage({ ok: false, error: err.message || String(err) });
    }
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, STATIC_CACHE, '/index.html'));
    return;
  }

  if (isTripData(url)) {
    event.respondWith(staleWhileRevalidate(req, TRIP_CACHE));
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }

  if (url.origin !== location.origin) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
  }
});

function isTripData(url) {
  return url.origin === location.origin && (
    url.pathname === '/trips/index.json' ||
    /^\/trips\/[^/]+\.csv$/.test(url.pathname) ||
    /^\/api\/trips\/[^/]+$/.test(url.pathname)
  );
}

function isShellAsset(url) {
  if (url.origin !== location.origin) {
    return SHELL_URLS.includes(url.href);
  }
  return [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/favicon.png',
    '/assets/thereandback-logo.png'
  ].includes(url.pathname) || url.pathname === '/app.js' || url.pathname === '/styles.css';
}

async function cacheEach(cacheName, urls) {
  const cache = await caches.open(cacheName);
  let saved = 0;
  await Promise.all([...new Set(urls)].map(async url => {
    try {
      const req = new Request(url, { credentials: 'same-origin' });
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        await cache.put(req, res.clone());
        saved += 1;
      }
    } catch (_) {
      // Keep saving the rest. Offline mode is best-effort by asset.
    }
  }));
  return saved;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetched = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetched;
}

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    return (await cache.match(req)) || (await cache.match(fallbackUrl));
  }
}

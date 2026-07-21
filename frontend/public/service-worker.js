/* SARKARIPYQ - Production Service Worker
 * Strategy:
 *   - Static assets (JS/CSS/fonts/images): cache-first
 *   - HTML navigation: network-first with offline fallback
 *   - API GETs: stale-while-revalidate (60s)
 *   - Mutations: never cached
 */

const VERSION = 'sarkaripyq-v2';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/ssc-logo.webp',
  '/manifest.json',
  '/offline.html'
];

const CACHEABLE_ORIGINS = new Set([self.location.origin]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' })))
        .catch(() => {/* ignore precache errors in dev */})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((name) => !name.startsWith(VERSION))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApi(request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(handleAsset(request));
  }
});

function isCacheableAsset(url) {
  return CACHEABLE_ORIGINS.has(url.origin) && (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|webp|avif|svg|woff2?)$/) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  );
}

async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline | SarkariPYQ</title>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}' +
      '.box{text-align:center;padding:24px;max-width:480px}' +
      'h1{color:#2563eb;margin:0 0 8px}a{color:#2563eb}</style></head>' +
      '<body><div class="box"><h1>Offline</h1>' +
      '<p>You appear to be offline. Please check your internet connection.</p>' +
      '<a href="/">Go to SarkariPYQ home</a></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        caches.open(STATIC_CACHE).then((c) => c.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function handleApi(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const response = await networkPromise;
  return response || new Response(JSON.stringify({ success: false, offline: true }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

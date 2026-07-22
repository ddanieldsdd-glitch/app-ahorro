const CACHE = 'presupuesto-v24';

const ASSETS = [
  '/', '/index.html', '/styles.css', '/manifest.json', '/icon.svg', '/version.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/js/crypto-e2e.js', '/js/store.js', '/js/budget-engine.js', '/js/install.js',
  '/js/presupuesto.js', '/js/dashboard.js', '/js/registro.js', '/js/calendario.js',
  '/js/semanas.js', '/js/graficos.js', '/js/movement-form.js', '/js/categorias.js',
  '/js/deudas.js', '/js/excel-io.js', '/js/backup-io.js', '/js/tutorial.js', '/js/vercel-analytics.js', '/js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never intercept Vercel platform routes (Analytics, Firewall, etc.)
  if (url.pathname.startsWith('/_vercel/')) return;
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(e.request));
  } else if (e.request.mode === 'navigate' || ASSETS.some((a) => url.pathname === a || url.pathname + '/' === a)) {
    e.respondWith(cacheFirst(e.request));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return caches.match('/index.html') || new Response('Sin conexión', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch {
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

const CACHE = 'presupuesto-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([
      '/', '/index.html', '/styles.css', '/manifest.json', '/icon.svg',
      '/js/store.js', '/js/presupuesto.js', '/js/dashboard.js',
      '/js/registro.js', '/js/semanas.js', '/js/graficos.js',
      '/js/categorias.js', '/js/app.js',
    ]))
  );
});

self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(networkFirst(e.request));
  } else {
    e.respondWith(cacheFirst(e.request));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  return hit || fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; });
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    return res;
  } catch {
    const hit = await caches.match(req);
    return hit || new Response(JSON.stringify({ error: 'offline' }), { status: 503 });
  }
}

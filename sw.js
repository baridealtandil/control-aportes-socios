// ============================================================
// SERVICE WORKER - Control de Aportes Paca Bar
// Estrategia: Network First con fallback a caché
// ============================================================

const CACHE_NAME = 'paca-bar-v29';
const STATIC_CACHE = 'paca-bar-static-v29';

// Recursos estáticos que se cachean al instalar
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/storage.js',
  '/styles.css',
  '/logo.jpg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── INSTALL: pre-cachear recursos estáticos ──────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cacheando recursos estáticos...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés viejos ──────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map(name => {
            console.log('[SW] Eliminando caché viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según tipo de recurso ───────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API del backend → Network Only (nunca cachear datos en vivo)
  if (url.hostname.includes('railway.app') || url.hostname.includes('dolarapi.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Si no hay red y es la API, devolver error JSON descriptivo
        return new Response(
          JSON.stringify({ error: 'Sin conexión. Los datos pueden estar desactualizados.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Recursos estáticos → Cache First, luego Network
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, cloned));
          }
          return response;
        });
      }).catch(() => {
        // Fallback: si es una navegación, devolver el index.html cacheado
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
    );
    return;
  }

  // Todo lo demás → Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── BACKGROUND SYNC (futuro): sincronizar cambios offline ────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    console.log('[SW] Background sync de transacciones pendientes');
    // Aquí se podrían sincronizar aportes guardados offline
  }
});

// ── PUSH NOTIFICATIONS (futuro) ──────────────────────────────
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Paca Bar', {
        body: data.body || 'Nueva notificación',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png'
      })
    );
  }
});

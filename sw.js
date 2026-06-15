// EcoProtect — Service Worker v2
// PWA complète : offline 100% + installation Android

const CACHE_NAME = 'ecoprotect-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Mise en cache des ressources');
      return cache.addAll(STATIC_ASSETS.filter(function(url) {
        // Ne pas mettre en cache les CDN qui peuvent échouer
        return !url.startsWith('https://') || url.includes('fonts') || url.includes('docx') || url.includes('html2pdf');
      })).catch(function(e) {
        console.warn('[SW] Certaines ressources non cachées:', e);
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Suppression ancien cache:', name);
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes : Cache First pour ressources statiques, Network First pour API
self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  
  // Ne pas intercepter les requêtes Firebase, Google Calendar, Drive
  if (url.includes('firestore.googleapis.com') ||
      url.includes('googleapis.com/calendar') ||
      url.includes('googleapis.com/drive') ||
      url.includes('googleapis.com/upload') ||
      url.includes('accounts.google.com') ||
      url.includes('firebase') ||
      url.includes('gstatic.com/firebasejs')) {
    return; // Laisser passer sans interception
  }

  // Strategy: Stale While Revalidate pour les ressources statiques
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        var fetchPromise = fetch(event.request).then(function(networkResponse) {
          // Mettre en cache la nouvelle réponse
          if (networkResponse && networkResponse.status === 200) {
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(function() {
          // Réseau indisponible — utiliser le cache
          return cachedResponse;
        });

        // Retourner le cache immédiatement si disponible, revalider en arrière-plan
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Message de mise à jour
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

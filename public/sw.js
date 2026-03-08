const CACHE_NAME = 'sama-wifi-v29';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/index.html?v=7.0',
    '/manifest.json?v=7.0',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/assets/css/modern-ui.css?v=7.0',
    '/assets/js/app.js?v=7.0',
    '/assets/js/ui-init.js?v=7.0',
    '/assets/js/db-manager.js?v=7.0',
    '/assets/js/firebase-init.js',
    '/assets/img/sama-logo.png?v=7.0',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Network First, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If it's a valid response, add it to the cache
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network fails (offline), return from cache
                return caches.match(event.request, { ignoreSearch: true });
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

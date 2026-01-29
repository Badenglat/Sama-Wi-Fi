const CACHE_NAME = 'sama-wifi-v6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json?v=3.5',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/assets/css/modern-ui.css?v=3.5',
    '/assets/js/app.js?v=3.5',
    '/assets/js/ui-init.js?v=3.5',
    '/assets/js/db-manager.js',
    '/assets/img/sama-logo.png?v=3.5',
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
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If offline, try to match in cache (ignoring search params if needed)
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

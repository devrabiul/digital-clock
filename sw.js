const CACHE = 'digital-clock-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const APP_FILES = [
    './',
    'index.html',
    'style.css',
    'js/app.js',
    'favicon.png',
    'github.svg',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Network first, so a deploy shows up on the next online load without bumping CACHE
async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (e) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return cache.match('./');
        throw e;
    }
}

// Font files are immutable, and only the ones a skin has used get stored
async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin === self.location.origin) event.respondWith(networkFirst(event.request));
    else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(event.request));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => (
            clients.length ? clients[0].focus() : self.clients.openWindow('./')
        ))
    );
});

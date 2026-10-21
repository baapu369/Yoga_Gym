/* Offline support. Network first, so users always get the latest version when online;
   falls back to the cached copy when offline. Bump CACHE when the file list changes. */
const CACHE = 'profit-v9';
const FILES = [
    './', 'index.html', 'css/style.css', 'manifest.webmanifest',
    'vendor/Sortable.min.js',
    'js/storage.js', 'js/plan.js', 'js/timescale.js', 'js/routines.js', 'js/backup.js', 'js/workout.js', 'js/app.js',
    'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
                return res;
            })
            .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
});

/* Service Worker — Law System PWA
   Estratégia: cache shell (HTML/CSS/JS) + network-first pra API.
*/
const CACHE = 'lawsys-v2';
const SHELL = [
    '/dash.html',
    '/index.html',
    '/admin.html',
    '/css/theme.css',
    '/config.js',
    '/js/common.js',
    '/js/dashboard.js',
    '/js/subjects.js',
    '/js/teachers.js',
    '/js/books.js',
    '/js/flashcards.js',
    '/js/sessions.js',
    '/js/history.js',
    '/js/calendar.js',
    '/js/schedule.js',
    '/js/profile.js',
    '/js/active-session.js',
    '/js/search.js',
    '/js/intelligence.js',
    '/js/notes.js',
    '/js/app.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => null))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API: network-first (sempre tenta rede; fallback cache se offline)
    if (url.host.includes('lawsysback.vercel.app') || url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // CDNs externos (tailwind, fontawesome, chart.js, pdf.js, tesseract):
    // cache-first com refresh em background
    if (url.host.includes('cdn.') || url.host.includes('cdnjs.cloudflare.com') || url.host.includes('jsdelivr.net') || url.host.includes('googleapis.com') || url.host.includes('gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then(cached =>
                cached || fetch(event.request).then(resp => {
                    if (resp.ok) caches.open(CACHE).then(c => c.put(event.request, resp.clone()));
                    return resp;
                }).catch(() => cached)
            )
        );
        return;
    }

    // Shell: cache-first
    if (event.request.method === 'GET' && url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached =>
                cached || fetch(event.request).then(resp => {
                    if (resp.ok) caches.open(CACHE).then(c => c.put(event.request, resp.clone()));
                    return resp;
                }).catch(() => caches.match('/dash.html'))
            )
        );
    }
});

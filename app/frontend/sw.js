/* Service Worker — Law System PWA
   Estratégia: network-first sempre (evita servir HTML/JS desatualizado).
   Cache só usado como fallback offline.
*/
const CACHE = 'lawsys-v4';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Limpa caches antigos
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // API do backend: passa direto (sem cache, sem interceptar)
    if (url.host.includes('lawsysback.vercel.app')) {
        return;  // browser default
    }

    // Pra requests de navegação (HTML): network-first com fallback offline
    if (req.mode === 'navigate' || req.destination === 'document') {
        event.respondWith(
            fetch(req).then(resp => {
                // Salva no cache pra fallback offline
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(req, clone));
                }
                return resp;
            }).catch(() => caches.match(req).then(c => c || caches.match('/index.html') || caches.match('/dash.html')))
        );
        return;
    }

    // Assets locais (JS/CSS): network-first, atualiza cache em background
    if (url.origin === location.origin) {
        event.respondWith(
            fetch(req).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(req, clone));
                }
                return resp;
            }).catch(() => caches.match(req))
        );
        return;
    }

    // CDNs externos: cache-first (são imutáveis pela URL versionada)
    event.respondWith(
        caches.match(req).then(cached =>
            cached || fetch(req).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(req, clone));
                }
                return resp;
            }).catch(() => cached)
        )
    );
});

// Mensagem do client pra forçar reset
self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
    if (event.data === 'clear-cache') {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    }
});

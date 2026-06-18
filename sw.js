// TCG Helper — Service Worker (offline)
const SHELL_CACHE = 'tcg-shell-v12';
const CARDS_CACHE = 'tcg-cards-v1';
const SHELL = [
  './',
  './tcg_helper.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './appicon.png',
  './ShockTCGHelperLogo.png',
  './deck-crustle.png',
  './deck-slowking.png',
  './deck-dragapult.png',
  './deck-zam.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll falha se algum item 404 — usamos individual pra ser tolerante ('./' pode não existir)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        ks.filter((k) => k !== SHELL_CACHE && k !== CARDS_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Artes das cartas (Limitless) + sprites Pokémon (PokeAPI/GitHub): cache-first, guarda na 1ª vez = offline
  if (url.hostname.indexOf('limitlesstcg') !== -1 || url.hostname.indexOf('githubusercontent') !== -1) {
    e.respondWith(
      caches.open(CARDS_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        } catch (_) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // App shell (mesmo domínio): cache-first com atualização em background
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit || caches.match('./tcg_helper.html'));
        return hit || net;
      })
    );
  }
});

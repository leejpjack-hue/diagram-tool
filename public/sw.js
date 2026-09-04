const CACHE_NAME = 'diagram-tool-shell-v3';
const APP_SHELL = ['/', '/app/', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function navigationDest(pathname) {
  return pathname === '/app' || pathname.startsWith('/app/') ? '/app/' : '/';
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    const dest = navigationDest(requestUrl.pathname);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(dest, copy));
          return response;
        })
        .catch(() => caches.match(dest, { ignoreSearch: true, ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});

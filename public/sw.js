// Service Worker Kill Switch: 잔류 서비스워커 해제 및 모든 캐시 소멸
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      if ('caches' in self) {
        return caches.keys().then((keys) => {
          return Promise.all(keys.map((key) => caches.delete(key)));
        });
      }
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    })
  );
});

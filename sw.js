'use strict';
// AJOURA moved to https://ajoura-app.github.io/. This worker replaces the old offline cache: it clears it and
// unregisters itself, so installed apps load the move page (muutto.js) from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('ajoura-pwa-')).map(key => caches.delete(key))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => clients.forEach(c => c.navigate(c.url).catch(() => {}))));
});

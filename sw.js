// Cache minimal pour la démonstration web, limité aux ressources locales.
const CACHE = 'moniteur-jsb-preview-v9';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './interaction_gate.js', './workout_manager.js', './workout_library.js', './duration_presets.js', './training_modes.js', './random_signals.js', './sound_engine.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));}
    return response;
  }).catch(() => caches.match(event.request)));
});

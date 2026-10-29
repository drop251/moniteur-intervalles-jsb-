// Moniteur JSB v3.5 — quatre espaces, dernier minuteur et temps modifiables en pause.
// Une nouvelle version de cache évite de conserver l'ancienne interface.
const CACHE = 'moniteur-jsb-web-v35';
const ASSETS = [
  './','./index.html','./premium_v2.css?v=35',
  './manifest.webmanifest','./icon.svg',
  './interaction_gate.js','./workout_manager.js','./workout_library.js',
  './duration_presets.js','./training_modes.js','./random_signals.js',
  './jsb_audio_samples.js','./sound_engine.js','./audio_cues.js',
  './pause_adjustments.js',
  './assets/audio/buzzer_combat.wav','./assets/audio/cloche_ring.wav',
  './assets/audio/sifflet_arbitre.wav','./assets/audio/corne_sportive.wav',
];
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith('moniteur-jsb-') && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' ||
      new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

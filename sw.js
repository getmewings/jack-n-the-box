// Network first so a new day's box is always fresh; cache as a fallback for the subway.
const V = 'jack-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './src/style.css', './src/app.js', './src/engine.js', './src/gl.js', './src/boxes/ink.js', './src/boxes/seed.js', './src/boxes/index.js',
  './src/boxes/hole.js', './src/boxes/fireflies.js', './src/boxes/breath.js', './src/boxes/eye.js', './src/boxes/lightning.js', './src/boxes/mirror.js', './src/boxes/voice.js', './icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});

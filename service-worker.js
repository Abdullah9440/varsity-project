/* Service worker: caches the app files so the library opens offline. */
const CACHE_NAME = "habhit-library-v1";
const APP_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/habht.jpeg",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_FILES); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; })
        .map(function (key) { return caches.delete(key); }));
    })
  );
  self.clients.claim();
});

// Network first (so updates show up), falling back to the cache when offline.
self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && new URL(request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("/index.html");
        return Response.error();
      });
    })
  );
});

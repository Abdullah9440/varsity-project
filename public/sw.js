// Service worker for Habhit:
// - makes the app installable (it has a fetch handler and works offline)
// - keeps itself up to date (skipWaiting + clients.claim + old cache cleanup)
// - shows task alarms as notifications, even when the site is closed

// Change this version whenever the caching logic changes, so old caches are removed.
const CACHE_VERSION = "habhit-v2";

// Basic files needed to open the app offline
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/install.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: cache the app shell, then activate the new worker right away
// instead of waiting for every open tab to close.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .catch(function (e) { console.warn("App shell caching failed", e); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Activate: delete caches from older versions and take control of open pages now
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: "network first, cache as fallback".
// The latest version from the server is always used when online, so an old cached
// copy can never block a new release. The cache is only used when offline.
self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  // Only handle this site's own files; never cache the API or the service worker itself
  if (url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/.netlify/") ||
      url.pathname === "/sw.js") {
    return;
  }

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) {
          return cached;
        }
        // Offline and the page is not cached: fall back to the cached start page
        if (request.mode === "navigate") {
          return caches.match("/");
        }
        return Response.error();
      });
    })
  );
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : "Task alarm" };
  }

  const title = "\u{1F514} " + (data.title || "Task alarm");
  const options = {
    body: data.body || "Your task is starting now",
    tag: "task-" + (data.taskId || "alarm"),
    renotify: true,
    requireInteraction: true,          // stays on screen until the user reacts
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { taskId: data.taskId, url: "/" },
    actions: [{ action: "open", title: "Open" }]
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(function () {
      // If the app is open in a tab, let it ring the in-page alarm too
      return self.clients.matchAll({ type: "window", includeUncontrolled: true });
    }).then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({ type: "alarm", taskId: data.taskId });
      });
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

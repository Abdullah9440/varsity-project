// Service worker: shows task alarms as notifications, even when the site is closed

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
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

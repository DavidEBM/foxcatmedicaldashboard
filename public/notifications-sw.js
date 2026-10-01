/* Public notification worker endpoint retained for clients that request /notifications-sw.js. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const notification = payload.notification || payload;
  const title = notification.title || "Foxcat Medical";
  const options = {
    body: notification.body || "Tienes una nueva notificación clínica.",
    data: payload.data || {},
    tag: notification.tag || "foxcat-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data && event.notification.data.url;
  let targetUrl = new URL("/doctor", self.location.origin);
  if (typeof requestedUrl === "string") {
    try {
      const parsedUrl = new URL(requestedUrl, self.location.origin);
      if (parsedUrl.origin === self.location.origin) targetUrl = parsedUrl;
    } catch {
      // Open the default clinical dashboard for malformed URLs.
    }
  }

  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existingClient = clients.find((client) => "focus" in client);
    if (existingClient && "navigate" in existingClient) {
      return existingClient.navigate(targetUrl.href).then((client) => client && client.focus());
    }
    return self.clients.openWindow(targetUrl.href);
  }));
});

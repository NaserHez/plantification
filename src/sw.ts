/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Fallback for SPA navigations (excluding OAuth)
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: "html", networkTimeoutSeconds: 3 }),
    { denylist: [/^\/~oauth/] }
  )
);

registerRoute(
  ({ url }) => url.hostname === "api.open-meteo.com",
  new NetworkFirst({
    cacheName: "weather-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 3600 })],
  })
);

// === Push notifications (watering reminders) ===
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; icon?: string; tag?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || "🌱 Plants need water!";
  const options: NotificationOptions = {
    body: data.body || "Some of your plants are overdue for watering.",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "watering-reminder",
    data: { url: data.url || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          (c as WindowClient).navigate(url);
          return (c as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

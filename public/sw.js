// ---------------------------------------------------------------------------
// Veloce CRM service worker
// Handles Web Push notifications and notification clicks. Kept intentionally
// minimal — no offline caching, to avoid serving stale CRM data.
// ---------------------------------------------------------------------------

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "Veloce CRM", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "Veloce CRM"
  const options = {
    body: data.body || "",
    icon: "/icons/192",
    badge: "/icons/192",
    tag: data.tag || "veloce-crm",
    renotify: true,
    // A customer message is worth interrupting for: keep it on screen until
    // it is acted on, instead of auto-dismissing after a few seconds.
    requireInteraction: true,
    data: { url: data.url || "/inbox" },
    vibrate: [120, 60, 120],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path =
    (event.notification.data && event.notification.data.url) || "/inbox"
  const targetUrl = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse a tab that is already on our origin. navigate() throws for
        // cross-origin or uncontrolled clients, so it must never be the only
        // path to focusing the app.
        for (const client of clientList) {
          if (!client.url.startsWith(self.location.origin)) continue
          const focused = "focus" in client ? client.focus() : Promise.resolve(client)
          return Promise.resolve(focused)
            .then((c) => {
              const target = c || client
              if (target && "navigate" in target && target.url !== targetUrl) {
                return target.navigate(targetUrl).catch(() => target)
              }
              return target
            })
            .catch(() => self.clients.openWindow && self.clients.openWindow(targetUrl))
        }
        // Otherwise open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})

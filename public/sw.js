// ---------------------------------------------------------------------------
// Veloce CRM service worker
// Handles Web Push notifications and notification clicks. Kept intentionally
// minimal — no offline caching, to avoid serving stale CRM data.
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
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
    data: { url: data.url || "/inbox" },
    vibrate: [120, 60, 120],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/inbox"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is open
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Otherwise open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

"use client"

import { useEffect } from "react"

// Registers the service worker once, silently, on app load.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] Registration failed:", err)
    })
  }, [])

  return null
}

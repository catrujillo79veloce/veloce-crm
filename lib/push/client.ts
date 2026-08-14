"use client"

// ---------------------------------------------------------------------------
// Browser-side Web Push helpers, shared by the settings card and the banner
// that nags you to turn notifications on. Kept in one place so the two can
// never drift on subscription details.
// ---------------------------------------------------------------------------

export type PushState =
  | "loading"
  | "unsupported" // browser has no Push API
  | "needs-install" // iOS Safari: only works once added to the Home Screen
  | "denied"
  | "off"
  | "on"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac with touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "loading"

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // On iOS the APIs only appear once the app is installed to the Home Screen.
    return isIOS() && !isStandalone() ? "needs-install" : "unsupported"
  }
  if (Notification.permission === "denied") return "denied"

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return "off"
    // A stored subscription still has to be known to the server — re-registering
    // is cheap and repairs the case where the row was pruned or the device was
    // subscribed against an older VAPID key.
    void syncSubscription(sub)
    return "on"
  } catch {
    return "off"
  }
}

async function syncSubscription(sub: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  return res.ok
}

export async function enablePush(): Promise<
  { ok: true } | { ok: false; state: PushState; error?: string }
> {
  if (!VAPID_PUBLIC_KEY) {
    return {
      ok: false,
      state: "unsupported",
      error: "Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY en el servidor.",
    }
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      ok: false,
      state: isIOS() && !isStandalone() ? "needs-install" : "unsupported",
    }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { ok: false, state: permission === "denied" ? "denied" : "off" }
    }

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      }))

    if (!(await syncSubscription(sub))) {
      return { ok: false, state: "off", error: "El servidor rechazó la suscripción." }
    }
    return { ok: true }
  } catch (e) {
    console.error("[Push] Enable failed:", e)
    return {
      ok: false,
      state: "off",
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}

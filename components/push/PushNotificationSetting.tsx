"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Loader2, Check, Smartphone } from "lucide-react"

// ---------------------------------------------------------------------------
// PushNotificationSetting
// Settings card to enable/disable Web Push on THIS device + send a test.
// ---------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

type State = "loading" | "unsupported" | "denied" | "off" | "on"

export default function PushNotificationSetting() {
  const [state, setState] = useState<State>("loading")
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState(false)

  useEffect(() => {
    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        setState("denied")
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? "on" : "off")
      } catch {
        setState("off")
      }
    }
    init()
  }, [])

  async function enable() {
    if (!VAPID_PUBLIC_KEY) {
      alert("Falta configurar la clave VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY).")
      return
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error()
      setState("on")
    } catch (e) {
      console.error("[Push] Enable failed:", e)
      setState("off")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState("off")
    } catch (e) {
      console.error("[Push] Disable failed:", e)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setTested(false)
    try {
      await fetch("/api/push/test", { method: "POST" })
      setTested(true)
      setTimeout(() => setTested(false), 3000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="h-5 w-5 text-veloce-600" />
        <h3 className="font-semibold text-gray-900">Notificaciones en este dispositivo</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Recibe una alerta instantánea cuando llegue un mensaje nuevo, aunque no
        tengas el CRM abierto. Actívalo en tu celular para no perder ningún lead.
      </p>

      {state === "loading" && (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      )}

      {state === "unsupported" && (
        <p className="text-sm text-amber-600">
          Este navegador no soporta notificaciones push. En iPhone: abre el CRM
          en Safari, tócalo "Compartir" → "Agregar a inicio", ábrelo desde el
          ícono y vuelve aquí.
        </p>
      )}

      {state === "denied" && (
        <p className="text-sm text-red-600">
          Bloqueaste las notificaciones. Actívalas en los ajustes del navegador
          para este sitio y recarga.
        </p>
      )}

      {state === "off" && (
        <button
          onClick={enable}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Activar notificaciones
        </button>
      )}

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <Check className="h-4 w-4" />
            Activadas en este dispositivo
          </span>
          <button
            onClick={test}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium"
          >
            {tested ? <Check className="h-4 w-4 text-green-600" /> : <Bell className="h-4 w-4" />}
            {tested ? "Enviada" : "Probar"}
          </button>
          <button
            onClick={disable}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg font-medium"
          >
            <BellOff className="h-4 w-4" />
            Desactivar
          </button>
        </div>
      )}
    </div>
  )
}

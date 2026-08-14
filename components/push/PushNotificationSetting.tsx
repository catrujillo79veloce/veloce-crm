"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Loader2, Check, Smartphone, Share } from "lucide-react"
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState,
} from "@/lib/push/client"

// ---------------------------------------------------------------------------
// PushNotificationSetting
// Settings card to enable/disable Web Push on THIS device + send a test.
// The subscription logic lives in lib/push/client so this card and the
// app-wide banner can never disagree about what "enabled" means.
// ---------------------------------------------------------------------------

export default function PushNotificationSetting() {
  const [state, setState] = useState<PushState>("loading")
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState<"idle" | "sent" | "nobody" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPushState().then((s) => {
      if (!cancelled) setState(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const result = await enablePush()
      if (result.ok) {
        setState("on")
      } else {
        setState(result.state)
        if (result.error) setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await disablePush()
      setState("off")
    } catch (e) {
      console.error("[Push] Disable failed:", e)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setTested("idle")
    try {
      const res = await fetch("/api/push/test", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      // A test that "succeeds" while reaching zero devices is the exact
      // failure this screen exists to catch — say so instead of showing a tick.
      if (res.ok && (data.sent ?? 0) > 0) setTested("sent")
      else if (res.ok) setTested("nobody")
      else setTested("error")
      setTimeout(() => setTested("idle"), 5000)
    } catch {
      setTested("error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="h-5 w-5 text-veloce-600" />
        <h3 className="font-semibold text-gray-900">
          Notificaciones en este dispositivo
        </h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Recibe una alerta instantánea cuando llegue un mensaje nuevo, aunque no
        tengas el CRM abierto. Actívalo en tu celular para no perder ningún lead.
      </p>

      {state === "loading" && (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      )}

      {state === "needs-install" && (
        <p className="text-sm text-amber-600">
          En iPhone las notificaciones solo funcionan con el CRM instalado:
          toca <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Compartir →
          &quot;Agregar a inicio&quot;, abre el CRM desde ese ícono y vuelve
          aquí.
        </p>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-amber-600">
          Este navegador no soporta notificaciones push.
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
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
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
            {tested === "sent" ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {tested === "sent" ? "Enviada" : "Probar"}
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

      {tested === "nobody" && (
        <p className="mt-3 text-sm text-amber-600">
          El servidor no encontró ningún dispositivo suscrito. Desactiva y
          vuelve a activar las notificaciones en este equipo.
        </p>
      )}
      {tested === "error" && (
        <p className="mt-3 text-sm text-red-600">
          No se pudo enviar la prueba. Revisa que las claves VAPID estén
          configuradas en el servidor.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}

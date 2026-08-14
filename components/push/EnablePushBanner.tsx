"use client"

// ---------------------------------------------------------------------------
// EnablePushBanner
//
// Push was already built but the switch lived buried in /settings, so in
// practice a single desktop browser was ever subscribed and the phone never
// was — which is why new WhatsApp messages went unnoticed. This puts the
// one-tap switch on every CRM screen until notifications are actually on.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react"
import { Bell, Loader2, X, Share } from "lucide-react"
import {
  enablePush,
  getPushState,
  isIOS,
  isStandalone,
  type PushState,
} from "@/lib/push/client"
import { useToast } from "@/components/ui/Toast"

const SNOOZE_KEY = "veloce-push-banner-snoozed-until"
const SNOOZE_DAYS = 3

function isSnoozed(): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY)
    return !!until && Date.now() < Number(until)
  } catch {
    return false
  }
}

function snooze() {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000)
    )
  } catch {
    /* private mode — the banner just reappears next load */
  }
}

export default function EnablePushBanner() {
  const [state, setState] = useState<PushState>("loading")
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    getPushState().then((s) => {
      if (cancelled) return
      setState(s)
      setDismissed(isSnoozed())
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleEnable() {
    setBusy(true)
    try {
      const result = await enablePush()
      if (result.ok) {
        setState("on")
        toast("success", "Listo — te avisamos en este dispositivo cuando escriban.")
      } else {
        setState(result.state)
        if (result.error) toast("error", result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  function handleDismiss() {
    snooze()
    setDismissed(true)
  }

  // Nothing to nag about: already on, still loading, or snoozed.
  if (state === "loading" || state === "on" || dismissed) return null

  // iOS only exposes the Push API to installed PWAs. Telling someone to "allow
  // notifications" on iPhone Safari sends them looking for a setting that does
  // not exist, so show the actual install steps instead.
  if (state === "needs-install" || (isIOS() && !isStandalone())) {
    return (
      <Banner onDismiss={handleDismiss} tone="amber">
        <p className="text-sm font-semibold text-amber-900">
          Activa las alertas en tu iPhone
        </p>
        <p className="text-sm text-amber-800 mt-0.5">
          Toca{" "}
          <Share className="inline h-3.5 w-3.5 -mt-0.5" aria-label="Compartir" />{" "}
          <strong>Compartir</strong> → <strong>Agregar a inicio</strong>, abre el
          CRM desde ese ícono y vuelve aquí. iOS solo permite notificaciones a
          apps instaladas.
        </p>
      </Banner>
    )
  }

  if (state === "denied") {
    return (
      <Banner onDismiss={handleDismiss} tone="red">
        <p className="text-sm font-semibold text-red-900">
          Las notificaciones están bloqueadas
        </p>
        <p className="text-sm text-red-800 mt-0.5">
          Actívalas en los ajustes del navegador para este sitio y recarga la
          página. Sin esto no te enteras de un mensaje si no tienes el CRM
          abierto.
        </p>
      </Banner>
    )
  }

  if (state === "unsupported") return null

  return (
    <Banner onDismiss={handleDismiss} tone="veloce">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Activa las notificaciones en este dispositivo
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            Te avisamos apenas un cliente escriba, aunque no tengas el CRM
            abierto.
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm flex-shrink-0"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Activar
        </button>
      </div>
    </Banner>
  )
}

function Banner({
  children,
  onDismiss,
  tone,
}: {
  children: React.ReactNode
  onDismiss: () => void
  tone: "veloce" | "amber" | "red"
}) {
  const tones = {
    veloce: "bg-veloce-50 border-veloce-200",
    amber: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
  }
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
      role="status"
    >
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600"
        aria-label="Ocultar por ahora"
        title="Ocultar por 3 días"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

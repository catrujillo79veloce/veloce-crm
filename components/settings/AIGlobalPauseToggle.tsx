"use client"

import { useEffect, useState } from "react"
import { Bot, BotOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// AIGlobalPauseToggle
// Banner-style switch at the top of /settings. When ON (paused), no webhook
// invokes the AI auto-reply — useful when staff is attending in person.
// ---------------------------------------------------------------------------

export default function AIGlobalPauseToggle() {
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/settings/ai-pause", { cache: "no-store" })
        const data = await res.json()
        if (!cancelled && data?.success) setPaused(Boolean(data.paused))
      } catch (e) {
        console.error("Load AI pause state error:", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async () => {
    if (saving || loading) return
    const next = !paused
    setSaving(true)
    setPaused(next) // optimistic
    try {
      const res = await fetch("/api/settings/ai-pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      })
      const data = await res.json()
      if (!data?.success) {
        setPaused(!next)
        console.error("Toggle AI pause failed:", data?.error)
      }
    } catch (e) {
      setPaused(!next)
      console.error("Toggle AI pause error:", e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-center gap-4 transition-colors",
        paused
          ? "bg-amber-50 border-amber-200"
          : "bg-green-50 border-green-200"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          paused ? "bg-amber-100" : "bg-green-100"
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
        ) : paused ? (
          <BotOff className="h-5 w-5 text-amber-700" />
        ) : (
          <Bot className="h-5 w-5 text-green-700" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">
          Respuesta automatica de IA
        </h3>
        <p className="text-xs text-gray-600 mt-0.5">
          {paused
            ? "PAUSADA - Los mensajes entrantes NO reciben respuesta automatica. Tu equipo debe responder manualmente."
            : "ACTIVA - Los mensajes entrantes reciben respuesta automatica del asistente. Si tu equipo responde, la IA se pausa para ese contacto."}
        </p>
      </div>

      <button
        onClick={toggle}
        disabled={loading || saving}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          paused ? "bg-amber-500" : "bg-green-500",
          (loading || saving) && "opacity-60 cursor-wait"
        )}
        aria-label={paused ? "Reactivar IA global" : "Pausar IA global"}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            paused ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  )
}

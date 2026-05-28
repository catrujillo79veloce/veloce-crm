"use client"

import { useEffect, useState } from "react"
import { PenLine, Loader2, Check } from "lucide-react"

// ---------------------------------------------------------------------------
// SignatureSetting — optional signature appended to manual agent messages.
// ---------------------------------------------------------------------------

export default function SignatureSetting() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [text, setText] = useState("")
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    fetch("/api/settings/signature", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setText(d.text ?? "")
          setEnabled(!!d.enabled)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save(next?: { enabled?: boolean }) {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/settings/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, enabled: next?.enabled ?? enabled }),
      })
      const d = await res.json()
      if (d?.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="h-5 w-5 text-veloce-600" />
        <h3 className="font-semibold text-gray-900">Firma automática</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Se agrega al final de los mensajes que envías manualmente desde la
        bandeja (no aplica a las respuestas del bot).
      </p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="— Carlos | Veloce 🚴 El Poblado, Medellín"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked)
                  save({ enabled: e.target.checked })
                }}
                className="rounded"
              />
              Activar firma automática
            </label>
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

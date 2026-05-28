"use client"

import { useEffect, useState } from "react"
import { Star, Loader2, Check } from "lucide-react"

// ---------------------------------------------------------------------------
// GoogleReviewSetting
// Card on /settings to paste the Google review link and toggle auto-send.
// ---------------------------------------------------------------------------

export default function GoogleReviewSetting() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [link, setLink] = useState("")
  const [autoSend, setAutoSend] = useState(true)

  useEffect(() => {
    fetch("/api/settings/review-link", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setLink(data.link ?? "")
          setAutoSend(data.autoSend !== false)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save(next?: { autoSend?: boolean }) {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/settings/review-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link,
          autoSend: next?.autoSend ?? autoSend,
        }),
      })
      const data = await res.json()
      if (data?.success) {
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
        <Star className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-gray-900">Reseñas de Google</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Pega tu link de reseñas de Google. El sistema lo usa para pedir reseñas
        a clientes después de un servicio o venta.
      </p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Link de reseñas (ej. https://g.page/r/.../review)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://g.page/r/xxxxxxxx/review"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
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
            <p className="text-xs text-gray-400 mt-1">
              Lo encuentras en tu Perfil de Negocio de Google → botón "Pedir
              reseñas" / "Obtén más opiniones".
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => {
                setAutoSend(e.target.checked)
                save({ autoSend: e.target.checked })
              }}
              className="rounded"
            />
            Enviar solicitud de reseña automáticamente (1 vez al día) a clientes
            recién atendidos
          </label>
        </div>
      )}
    </div>
  )
}

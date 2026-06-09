"use client"

import { useEffect, useState } from "react"
import { Repeat2, Loader2, Check, Wrench, Cake, RotateCcw } from "lucide-react"

// ---------------------------------------------------------------------------
// LifecycleSetting — toggles the daily lifecycle automation (winback,
// overhaul, birthday) and lets you wire the Meta-approved WhatsApp template
// name for each rule. Without a template name, the auto-generated draft
// uses a freeform message and is only sendable to contacts active in the
// last 24 h (WhatsApp policy).
// ---------------------------------------------------------------------------

interface Templates {
  winback_90d: string
  overhaul_1y: string
  birthday: string
}

const RULE_META: {
  key: keyof Templates
  label: string
  icon: React.ElementType
  description: string
}[] = [
  {
    key: "winback_90d",
    label: "Winback 90 días",
    icon: RotateCcw,
    description:
      "Clientes sin interacción hace ≥90 días reciben una invitación para volver.",
  },
  {
    key: "overhaul_1y",
    label: "Overhaul anual",
    icon: Wrench,
    description:
      "A quienes compraron una bici hace ~1 año les recordamos hacer mantenimiento.",
  },
  {
    key: "birthday",
    label: "Cumpleaños",
    icon: Cake,
    description: "Mensaje de feliz cumpleaños con un detalle de cortesía.",
  },
]

export default function LifecycleSetting() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [templates, setTemplates] = useState<Templates>({
    winback_90d: "",
    overhaul_1y: "",
    birthday: "",
  })

  useEffect(() => {
    fetch("/api/settings/lifecycle", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setEnabled(!!d.enabled)
          setTemplates(d.templates ?? templates)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(next?: { enabled?: boolean }) {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/settings/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next?.enabled ?? enabled,
          templates,
        }),
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
        <Repeat2 className="h-5 w-5 text-veloce-600" />
        <h3 className="font-semibold text-gray-900">
          Automatizaciones de ciclo de vida
        </h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Cada día se crea un borrador de campaña en Marketing con los clientes
        a los que tocaría escribirles. Tú revisas y envías con un clic.
      </p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-4">
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
            Activar generación automática de borradores
          </label>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs text-gray-500">
              Si pegas el nombre de una <em>plantilla aprobada por Meta</em>{" "}
              para cada regla, el borrador podrá enviarse a todos los
              candidatos. Si lo dejas vacío, el borrador queda en modo libre y
              solo llegará a quienes te escribieron en las últimas 24 h.
            </p>

            {RULE_META.map((r) => {
              const Icon = r.icon
              return (
                <div
                  key={r.key}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-veloce-600" />
                    <span className="font-medium text-sm text-gray-800">
                      {r.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{r.description}</p>
                  <input
                    type="text"
                    value={templates[r.key]}
                    onChange={(e) =>
                      setTemplates((prev) => ({
                        ...prev,
                        [r.key]: e.target.value,
                      }))
                    }
                    placeholder="nombre_plantilla_aprobada (opcional)"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
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
              Guardar plantillas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

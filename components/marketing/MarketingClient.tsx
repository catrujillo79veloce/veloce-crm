"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Megaphone,
  Plus,
  Loader2,
  Send,
  Check,
  Users,
  Clock,
  X,
  Sparkles,
} from "lucide-react"
import { useToast } from "@/components/ui/Toast"

// ---------------------------------------------------------------------------
// Marketing campaigns: list + create + send.
// Two modes: freeform (24h window) and template (Meta-approved, broadcast).
// ---------------------------------------------------------------------------

interface Campaign {
  id: string
  name: string
  mode: "freeform" | "template"
  body: string | null
  template_name: string | null
  status: "draft" | "sending" | "sent" | "cancelled"
  total_recipients: number
  sent_count: number
  failed_count: number
  skipped_count: number
  sent_at: string | null
  created_at: string
  audience?: {
    lifecycle_rule?: "winback_90d" | "overhaul_1y" | "birthday"
    [key: string]: unknown
  } | null
}

const LIFECYCLE_LABELS: Record<string, string> = {
  winback_90d: "Winback 90d",
  overhaul_1y: "Overhaul 1 año",
  birthday: "Cumpleaños",
}

const HOT_TAGS = [
  { name: "interes_compra", label: "Interés de compra" },
  { name: "separar_bici", label: "Quiere separar bici" },
  { name: "agendar_visita", label: "Quiere agendar" },
  { name: "mantenimiento", label: "Mantenimiento" },
  { name: "info_tienda", label: "Info tienda" },
]

export default function MarketingClient() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const fetchCampaigns = useCallback(() => {
    setLoading(true)
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => setCampaigns((data.campaigns ?? []) as Campaign[]))
      .catch(() => toast("error", "Error cargando campañas"))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  async function sendCampaign(c: Campaign) {
    if (
      !confirm(
        `¿Enviar "${c.name}" a ${c.total_recipients} contacto(s)?` +
          (c.mode === "freeform"
            ? "\n\nModo mensaje libre: solo se envía a quienes te escribieron en las últimas 24h."
            : "")
      )
    )
      return
    setSendingId(c.id)
    try {
      const res = await fetch(`/api/campaigns/${c.id}/send`, { method: "POST" })
      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "Error al enviar")
        return
      }
      toast(
        "success",
        `Enviados: ${body.sent} · Fallidos: ${body.failed} · Omitidos: ${body.skipped}`
      )
      fetchCampaigns()
    } catch {
      toast("error", "Error de red")
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-veloce-600" />
            Marketing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Campañas de WhatsApp a tu base de clientes
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="h-5 w-5" />
          Nueva campaña
        </button>
      </div>

      {/* Policy note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
        <strong>Importante (regla de WhatsApp):</strong> para enviar promociones
        a clientes fuera de 24h necesitas una <em>plantilla aprobada por Meta</em>
        (modo Plantilla). El modo <em>Mensaje libre</em> solo llega a quienes te
        escribieron en las últimas 24h.
      </div>

      {showForm && (
        <NewCampaignForm
          tags={HOT_TAGS}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            fetchCampaigns()
            toast("success", "Campaña creada")
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-veloce-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <Megaphone className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Aún no tienes campañas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {c.audience?.lifecycle_rule && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        <Sparkles className="h-3 w-3" />
                        Automático · {LIFECYCLE_LABELS[c.audience.lifecycle_rule]}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {c.mode === "template" ? "Plantilla" : "Mensaje libre"}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {c.body ?? `Plantilla: ${c.template_name}`}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.total_recipients} destinatarios
                    </span>
                    {c.status === "sent" && (
                      <>
                        <span className="text-green-600">✓ {c.sent_count} enviados</span>
                        {c.failed_count > 0 && (
                          <span className="text-red-500">✕ {c.failed_count} fallidos</span>
                        )}
                        {c.skipped_count > 0 && (
                          <span className="text-gray-400">
                            {c.skipped_count} omitidos (fuera de 24h)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {c.status === "draft" && (
                  <button
                    onClick={() => sendCampaign(c)}
                    disabled={sendingId === c.id}
                    className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm flex-shrink-0"
                  >
                    {sendingId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { label: string; cls: string; icon: React.ElementType }> = {
    draft: { label: "Borrador", cls: "bg-gray-100 text-gray-600", icon: Clock },
    sending: { label: "Enviando", cls: "bg-blue-100 text-blue-700", icon: Loader2 },
    sent: { label: "Enviada", cls: "bg-green-100 text-green-700", icon: Check },
    cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-600", icon: X },
  }
  const m = map[status]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// New campaign form (inline)
// ---------------------------------------------------------------------------

function NewCampaignForm({
  tags,
  onClose,
  onCreated,
}: {
  tags: { name: string; label: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"freeform" | "template">("freeform")
  const [text, setText] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateLang, setTemplateLang] = useState("es")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [preview, setPreview] = useState<{ total: number; within24h: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const audience = { tags: selectedTags.length > 0 ? selectedTags : undefined }

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      })
        .then((r) => r.json())
        .then((d) => setPreview({ total: d.total ?? 0, within24h: d.within24h ?? 0 }))
        .catch(() => setPreview(null))
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags.join(",")])

  function toggleTag(name: string) {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  async function create() {
    if (!name.trim()) return toast("error", "Falta el nombre")
    if (mode === "freeform" && !text.trim()) return toast("error", "Falta el mensaje")
    if (mode === "template" && !templateName.trim())
      return toast("error", "Falta el nombre de la plantilla")

    setSubmitting(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mode,
          text: text.trim(),
          template_name: templateName.trim(),
          template_lang: templateLang,
          audience,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "Error al crear")
        return
      }
      onCreated()
    } catch {
      toast("error", "Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Nueva campaña</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la campaña (interno)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />

      {/* Mode */}
      <div className="flex gap-2">
        {(["freeform", "template"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-sm px-3 py-2 rounded-lg border font-medium transition ${
              mode === m
                ? "bg-veloce-600 text-white border-veloce-600"
                : "bg-white border-gray-300 text-gray-700"
            }`}
          >
            {m === "freeform" ? "Mensaje libre (24h)" : "Plantilla aprobada"}
          </button>
        ))}
      </div>

      {mode === "freeform" ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Hola {nombre}! Llegaron las nuevas Orbea 2026 🚴 Pásate por Veloce El Poblado..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Usa <code>{"{nombre}"}</code> para personalizar con el nombre del cliente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="nombre_plantilla_aprobada"
            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={templateLang}
            onChange={(e) => setTemplateLang(e.target.value)}
            placeholder="es"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Audience */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Audiencia (por etiqueta — vacío = todos con WhatsApp)
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tg) => (
            <button
              key={tg.name}
              onClick={() => toggleTag(tg.name)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                selectedTags.includes(tg.name)
                  ? "bg-veloce-100 border-veloce-400 text-veloce-700"
                  : "bg-white border-gray-300 text-gray-600"
              }`}
            >
              {tg.label}
            </button>
          ))}
        </div>
        {preview && (
          <p className="text-sm text-gray-600 mt-3">
            <Users className="h-4 w-4 inline mr-1" />
            {preview.total} contactos con WhatsApp
            {mode === "freeform" && (
              <span className="text-gray-400">
                {" "}
                · {preview.within24h} dentro de 24h (los que recibirán)
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium text-sm">
          Cancelar
        </button>
        <button
          onClick={create}
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear campaña
        </button>
      </div>
    </div>
  )
}

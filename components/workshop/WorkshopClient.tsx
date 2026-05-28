"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Wrench,
  Plus,
  Loader2,
  MessageCircle,
  ArrowRight,
  Check,
  X,
  Bike,
  Star,
} from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import NewTicketDialog from "./NewTicketDialog"

// ---------------------------------------------------------------------------
// Workshop board — tickets grouped by status (kanban-style columns).
// ---------------------------------------------------------------------------

interface Ticket {
  id: string
  ticket_number: number
  bike_description: string
  service_type: string
  problem_description: string | null
  work_done: string | null
  status: "received" | "in_progress" | "ready" | "delivered" | "cancelled"
  estimated_cost_cop: number | null
  final_cost_cop: number | null
  estimated_ready_date: string | null
  received_at: string
  notes: string | null
  created_by: string
  contact: {
    id: string
    first_name: string
    last_name: string | null
    whatsapp_phone: string | null
    phone: string | null
  } | null
}

const COLUMNS: { key: Ticket["status"]; label: string; color: string }[] = [
  { key: "received", label: "Recibida", color: "border-blue-400" },
  { key: "in_progress", label: "En proceso", color: "border-yellow-400" },
  { key: "ready", label: "Lista para entregar", color: "border-green-400" },
]

const NEXT_STATUS: Partial<Record<Ticket["status"], Ticket["status"]>> = {
  received: "in_progress",
  in_progress: "ready",
  ready: "delivered",
}

const NEXT_LABEL: Partial<Record<Ticket["status"], string>> = {
  received: "Iniciar trabajo",
  in_progress: "Marcar lista",
  ready: "Entregar",
}

function fmtCop(n: number | null): string {
  if (n == null) return "—"
  return "$" + n.toLocaleString("es-CO")
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00-05:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  })
}

export default function WorkshopClient() {
  const { toast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showDelivered, setShowDelivered] = useState(false)

  const fetchTickets = useCallback(() => {
    setLoading(true)
    const status = showDelivered ? "all" : "active"
    fetch(`/api/tickets?status=${status}`)
      .then((r) => r.json())
      .then((data) => setTickets((data.tickets ?? []) as Ticket[]))
      .catch(() => toast("error", "Error cargando tickets"))
      .finally(() => setLoading(false))
  }, [showDelivered, toast])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  async function advance(t: Ticket) {
    const next = NEXT_STATUS[t.status]
    if (!next) return
    try {
      const res = await fetch(`/api/tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      toast("success", `Ticket #${t.ticket_number} → ${next}`)
      fetchTickets()
    } catch {
      toast("error", "No se pudo actualizar")
    }
  }

  async function askReview(contactId: string | undefined) {
    if (!contactId) return
    try {
      const res = await fetch("/api/reviews/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "No se pudo enviar")
        return
      }
      toast("success", "Solicitud de reseña enviada ⭐")
    } catch {
      toast("error", "Error de red")
    }
  }

  async function cancel(t: Ticket) {
    if (!confirm(`¿Cancelar el ticket #${t.ticket_number}?`)) return
    try {
      const res = await fetch(`/api/tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      if (!res.ok) throw new Error()
      toast("success", "Ticket cancelado")
      fetchTickets()
    } catch {
      toast("error", "No se pudo cancelar")
    }
  }

  const byStatus = (s: Ticket["status"]) => tickets.filter((t) => t.status === s)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-veloce-600" />
            Taller
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tickets de servicio. Mueve cada bici por las etapas hasta entregar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showDelivered}
              onChange={(e) => setShowDelivered(e.target.checked)}
              className="rounded"
            />
            Ver entregadas/canceladas
          </label>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Plus className="h-5 w-5" />
            Nuevo ticket
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-veloce-600" />
        </div>
      ) : (
        <>
          {/* Active board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const colTickets = byStatus(col.key)
              return (
                <div key={col.key} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="font-semibold text-gray-700 text-sm">
                      {col.label}
                    </h2>
                    <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                      {colTickets.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colTickets.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">
                        Sin tickets
                      </p>
                    ) : (
                      colTickets.map((t) => (
                        <TicketCard
                          key={t.id}
                          ticket={t}
                          columnColor={col.color}
                          onAdvance={advance}
                          onCancel={cancel}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Delivered / cancelled list */}
          {showDelivered && (
            <div className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                Entregadas y canceladas
              </h2>
              <div className="space-y-2">
                {tickets
                  .filter(
                    (t) => t.status === "delivered" || t.status === "cancelled"
                  )
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm"
                    >
                      <span className="text-gray-700 min-w-0 truncate">
                        #{t.ticket_number} · {t.bike_description} ·{" "}
                        {t.contact?.first_name}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.status === "delivered" && t.contact && (
                          <button
                            onClick={() => askReview(t.contact?.id)}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:bg-amber-50 px-2 py-1 rounded font-medium"
                            title="Enviar solicitud de reseña por WhatsApp"
                          >
                            <Star className="h-3.5 w-3.5" />
                            Pedir reseña
                          </button>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            t.status === "delivered"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {t.status === "delivered" ? "Entregada" : "Cancelada"}
                          {t.final_cost_cop ? ` · ${fmtCop(t.final_cost_cop)}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {dialogOpen && (
        <NewTicketDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false)
            fetchTickets()
            toast("success", "Ticket creado")
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket card
// ---------------------------------------------------------------------------

function TicketCard({
  ticket,
  columnColor,
  onAdvance,
  onCancel,
}: {
  ticket: Ticket
  columnColor: string
  onAdvance: (t: Ticket) => void
  onCancel: (t: Ticket) => void
}) {
  const t = ticket
  const contactName = t.contact
    ? `${t.contact.first_name}${t.contact.last_name ? " " + t.contact.last_name : ""}`
    : "Contacto eliminado"
  const phone = t.contact?.whatsapp_phone ?? t.contact?.phone ?? null
  const waLink = phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : null
  const nextLabel = NEXT_LABEL[t.status]

  return (
    <div
      className={`bg-white border-l-4 ${columnColor} border border-gray-200 rounded-lg p-3 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bike className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-sm truncate">
            {t.bike_description}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-400 flex-shrink-0">
          #{t.ticket_number}
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-1">{t.service_type}</p>
      <p className="text-xs text-gray-500">{contactName}</p>

      {t.problem_description && (
        <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
          {t.problem_description}
        </p>
      )}

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        {t.estimated_cost_cop != null && (
          <span>Estimado: {fmtCop(t.estimated_cost_cop)}</span>
        )}
        {t.estimated_ready_date && (
          <span>Listo: {fmtDate(t.estimated_ready_date)}</span>
        )}
        {t.created_by === "bot" && (
          <span className="text-purple-600">🤖</span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
        {nextLabel && (
          <button
            onClick={() => onAdvance(t)}
            className="inline-flex items-center gap-1 text-xs bg-veloce-50 text-veloce-700 hover:bg-veloce-100 px-2.5 py-1 rounded font-medium"
          >
            {t.status === "ready" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {nextLabel}
          </button>
        )}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
            title="Avisar por WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={() => onCancel(t)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-auto"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

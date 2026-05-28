"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bookmark,
  Plus,
  Loader2,
  MessageCircle,
  Phone,
  Check,
  X,
  AlertTriangle,
  DollarSign,
} from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import NewReservationDialog from "./NewReservationDialog"

// ---------------------------------------------------------------------------
// Reservations (separar bici) management view.
// ---------------------------------------------------------------------------

interface Reservation {
  id: string
  reservation_number: number
  product_name: string
  total_price_cop: number
  deposit_cop: number
  deposit_pct: number | null
  balance_cop: number
  status: "pending_payment" | "reserved" | "completed" | "cancelled" | "expired"
  deposit_paid: boolean
  deposit_paid_at: string | null
  payment_method: string | null
  expires_at: string | null
  notes: string | null
  created_by: string
  created_at: string
  contact: {
    id: string
    first_name: string
    last_name: string | null
    whatsapp_phone: string | null
    phone: string | null
  } | null
  product: { id: string; name: string; sku: string | null } | null
}

const STATUS_LABELS: Record<Reservation["status"], string> = {
  pending_payment: "Pendiente de abono",
  reserved: "Reservada (abono ✓)",
  completed: "Completada",
  cancelled: "Cancelada",
  expired: "Vencida",
}

const STATUS_COLORS: Record<Reservation["status"], string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  reserved: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
}

function fmtCop(n: number): string {
  return "$" + n.toLocaleString("es-CO")
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00-05:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const PAYMENT_METHODS = ["Transferencia", "Nequi", "Efectivo", "Datáfono", "Daviplata"]

export default function ReservationsClient() {
  const { toast } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("active")
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchReservations = useCallback(() => {
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    setLoading(true)
    fetch(`/api/reservations?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setReservations((data.reservations ?? []) as Reservation[]))
      .catch(() => toast("error", "Error cargando reservas"))
      .finally(() => setLoading(false))
  }, [statusFilter, toast])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  async function patch(id: string, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast("success", successMsg)
      fetchReservations()
    } catch {
      toast("error", "No se pudo actualizar")
    }
  }

  function markPaid(r: Reservation) {
    const method = prompt(
      `¿Cómo recibiste el abono de ${fmtCop(r.deposit_cop)}?\n(${PAYMENT_METHODS.join(", ")})`,
      "Transferencia"
    )
    if (method === null) return
    patch(r.id, { deposit_paid: true, payment_method: method }, "Abono registrado")
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-veloce-600" />
            Reservas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Separa bicicletas con abono. El sistema registra el acuerdo; tú
            confirmas el pago.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="h-5 w-5" />
          Nueva reserva
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { key: "active", label: "Activas" },
          { key: "completed", label: "Completadas" },
          { key: "cancelled", label: "Canceladas" },
          { key: "all", label: "Todas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === f.key
                ? "bg-veloce-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-veloce-600" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <Bookmark className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No hay reservas aquí</p>
          <p className="text-sm text-gray-500 mt-1">
            Crea una con el botón "+ Nueva reserva"
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => {
            const contactName = r.contact
              ? `${r.contact.first_name}${r.contact.last_name ? " " + r.contact.last_name : ""}`
              : "Contacto eliminado"
            const phone = r.contact?.whatsapp_phone ?? r.contact?.phone ?? null
            const waLink = phone
              ? `https://wa.me/${phone.replace(/[^\d]/g, "")}`
              : null
            const isActive =
              r.status === "pending_payment" || r.status === "reserved"
            const isExpiringSoon =
              r.expires_at &&
              isActive &&
              new Date(r.expires_at).getTime() - Date.now() < 3 * 24 * 3600 * 1000

            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">
                        #{r.reservation_number}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {r.product_name}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.created_by === "bot" && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          🤖 Bot
                        </span>
                      )}
                      {isExpiringSoon && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                          <AlertTriangle className="h-3 w-3" />
                          Vence {fmtDate(r.expires_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{contactName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                      <span className="text-gray-500">
                        Total:{" "}
                        <span className="font-semibold text-gray-900">
                          {fmtCop(r.total_price_cop)}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Abono{r.deposit_pct ? ` (${r.deposit_pct}%)` : ""}:{" "}
                        <span
                          className={`font-semibold ${r.deposit_paid ? "text-green-600" : "text-yellow-600"}`}
                        >
                          {fmtCop(r.deposit_cop)} {r.deposit_paid ? "✓" : "pendiente"}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Saldo:{" "}
                        <span className="font-semibold text-gray-900">
                          {fmtCop(r.balance_cop)}
                        </span>
                      </span>
                      {r.payment_method && (
                        <span className="text-gray-400">
                          vía {r.payment_method}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{r.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Llamar"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                {isActive && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    {!r.deposit_paid && (
                      <button
                        onClick={() => markPaid(r)}
                        className="inline-flex items-center gap-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium"
                      >
                        <DollarSign className="h-4 w-4" />
                        Registrar abono
                      </button>
                    )}
                    <button
                      onClick={() =>
                        patch(r.id, { status: "completed" }, "Reserva completada")
                      }
                      className="inline-flex items-center gap-1.5 text-sm bg-veloce-50 text-veloce-700 hover:bg-veloce-100 px-3 py-1.5 rounded-lg font-medium"
                    >
                      <Check className="h-4 w-4" />
                      Marcar vendida
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Cancelar esta reserva?")) {
                          patch(r.id, { status: "cancelled" }, "Reserva cancelada")
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {dialogOpen && (
        <NewReservationDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false)
            fetchReservations()
            toast("success", "Reserva creada")
          }}
        />
      )}
    </div>
  )
}

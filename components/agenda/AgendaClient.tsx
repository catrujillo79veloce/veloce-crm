"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Plus,
  Filter,
  Check,
  X,
  Clock,
  User,
  MessageCircle,
  Phone,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import NewAppointmentDialog from "./NewAppointmentDialog"

// ---------------------------------------------------------------------------
// Agenda — list view grouped by day, with filter by service.
// ---------------------------------------------------------------------------

interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  buffer_minutes: number
  price_cop: number | null
  color: string | null
  uses_fixed_slots: boolean
  capacity_per_slot: number
}

interface Appointment {
  id: string
  starts_at: string
  ends_at: string
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show"
  notes: string | null
  customer_notes: string | null
  created_by: string
  service: {
    id: string
    name: string
    color: string | null
    price_cop: number | null
  } | null
  contact: {
    id: string
    first_name: string
    last_name: string | null
    whatsapp_phone: string | null
    phone: string | null
    instagram_id: string | null
    facebook_id: string | null
  } | null
}

interface AgendaClientProps {
  services: Service[]
}

const STATUS_LABELS: Record<Appointment["status"], string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No vino",
}

const STATUS_COLORS: Record<Appointment["status"], string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700 line-through",
  no_show: "bg-orange-100 text-orange-700",
}

function formatBogotaDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatBogotaTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function dayKey(iso: string): string {
  // Group by Bogota date
  const d = new Date(iso)
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

export default function AgendaClient({ services }: AgendaClientProps) {
  const { toast } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceFilter, setServiceFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("active") // active = scheduled+confirmed
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next, -1 = prev
  const [dialogOpen, setDialogOpen] = useState(false)

  // Compute date range based on weekOffset
  const { fromDate, toDate, weekLabel } = useMemo(() => {
    const today = new Date()
    // Find Monday of this week in Bogota tz
    const bogotaToday = new Date(
      today.toLocaleString("en-US", { timeZone: "America/Bogota" })
    )
    const dow = bogotaToday.getDay() // 0=Sun, 1=Mon...
    const monday = new Date(bogotaToday)
    const daysToMonday = dow === 0 ? -6 : 1 - dow
    monday.setDate(bogotaToday.getDate() + daysToMonday + weekOffset * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const label = `${monday.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} – ${sunday.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`

    return { fromDate: monday, toDate: sunday, weekLabel: label }
  }, [weekOffset])

  // Fetch appointments
  useEffect(() => {
    const params = new URLSearchParams()
    params.set("from", fromDate.toISOString())
    params.set("to", toDate.toISOString())
    if (serviceFilter) params.set("contact_id", "") // ignored, kept for symmetry
    if (statusFilter === "active") {
      params.set("status", "scheduled,confirmed")
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter)
    }

    setLoading(true)
    fetch(`/api/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        let list = (data.appointments ?? []) as Appointment[]
        if (serviceFilter) {
          list = list.filter((a) => a.service?.id === serviceFilter)
        }
        setAppointments(list)
      })
      .catch(() => toast("error", "Error cargando citas"))
      .finally(() => setLoading(false))
  }, [fromDate, toDate, statusFilter, serviceFilter, toast])

  // Group by Bogota day
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appointments) {
      const key = dayKey(a.starts_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [appointments])

  async function updateStatus(id: string, status: Appointment["status"]) {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      )
      toast("success", "Cita actualizada")
    } catch {
      toast("error", "No se pudo actualizar la cita")
    }
  }

  function handleCreated() {
    // Re-fetch
    setDialogOpen(false)
    setStatusFilter((s) => s) // trigger useEffect (since dep is identity)
    // Force refetch by re-setting the same filter (React doesn't re-run if value unchanged)
    setWeekOffset((w) => w) // no-op but ensures fresh data on next interaction
    // Simpler: explicit fetch
    const params = new URLSearchParams()
    params.set("from", fromDate.toISOString())
    params.set("to", toDate.toISOString())
    if (statusFilter === "active") params.set("status", "scheduled,confirmed")
    fetch(`/api/appointments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setAppointments((data.appointments ?? []) as Appointment[]))
    toast("success", "Cita creada")
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ============ Header ============ */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-veloce-600" />
            Agenda
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bike Fit Retul, Asesorías, Taller e Indoor Cycling
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="h-5 w-5" />
          Nueva cita
        </button>
      </div>

      {/* ============ Filters + Week navigation ============ */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold text-gray-700 px-2 min-w-[180px] text-center">
            {weekLabel}
          </div>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-veloce-600 hover:underline ml-2"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">Todos los servicios</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
            <option value="all">Todas</option>
          </select>
        </div>
      </div>

      {/* ============ List ============ */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-veloce-600" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No hay citas en este rango</p>
          <p className="text-sm text-gray-500 mt-1">
            Crea una con el botón "+ Nueva cita"
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dayKey, apptsOfDay]) => {
            const firstAppt = apptsOfDay[0]
            const dayLabel = formatBogotaDate(firstAppt.starts_at)
            return (
              <div key={dayKey}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                  {dayLabel}
                </h2>
                <div className="space-y-2">
                  {apptsOfDay.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      appointment={a}
                      onUpdateStatus={updateStatus}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {dialogOpen && (
        <NewAppointmentDialog
          services={services}
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single appointment row
// ---------------------------------------------------------------------------

function AppointmentRow({
  appointment,
  onUpdateStatus,
}: {
  appointment: Appointment
  onUpdateStatus: (id: string, status: Appointment["status"]) => void
}) {
  const a = appointment
  const contactName = a.contact
    ? `${a.contact.first_name}${a.contact.last_name ? " " + a.contact.last_name : ""}`
    : "Contacto eliminado"

  const phone = a.contact?.whatsapp_phone ?? a.contact?.phone ?? null
  const cleanPhone = phone?.replace(/[^\d]/g, "")
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null

  const isActive = a.status === "scheduled" || a.status === "confirmed"

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 sm:items-center bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
      style={{ borderLeftColor: a.service?.color ?? "#22c55e", borderLeftWidth: 4 }}
    >
      <div className="flex items-center gap-2 sm:min-w-[110px] text-gray-700">
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="font-mono font-semibold text-sm">
          {formatBogotaTime(a.starts_at)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900">{a.service?.name}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[a.status]}`}
          >
            {STATUS_LABELS[a.status]}
          </span>
          {a.created_by === "bot" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
              🤖 Bot
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-3.5 w-3.5" />
          <span>{contactName}</span>
          {phone && <span className="text-gray-400">· {phone}</span>}
        </div>
        {(a.notes || a.customer_notes) && (
          <p className="text-xs text-gray-500 mt-1 italic">
            {a.customer_notes ?? a.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
            title="Abrir WhatsApp"
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
        {isActive && (
          <>
            <button
              onClick={() => onUpdateStatus(a.id, "completed")}
              className="p-2 text-green-700 hover:bg-green-50 rounded-lg"
              title="Marcar completada"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm("¿Seguro que quieres cancelar esta cita?")) {
                  onUpdateStatus(a.id, "cancelled")
                }
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

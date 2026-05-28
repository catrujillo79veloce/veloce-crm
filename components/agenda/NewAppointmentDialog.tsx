"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Calendar, Search } from "lucide-react"
import { useToast } from "@/components/ui/Toast"

// ---------------------------------------------------------------------------
// Dialog to create a new appointment.
// Steps: choose service → choose contact → choose slot → confirm.
// ---------------------------------------------------------------------------

interface Service {
  id: string
  name: string
  duration_minutes: number
  price_cop: number | null
  color: string | null
  uses_fixed_slots: boolean
}

interface Slot {
  starts_at: string
  ends_at: string
  starts_at_local: string
  available_capacity: number
}

interface Contact {
  id: string
  first_name: string
  last_name: string | null
  whatsapp_phone: string | null
  phone: string | null
  source: string | null
}

interface Props {
  services: Service[]
  onClose: () => void
  onCreated: () => void
}

export default function NewAppointmentDialog({
  services,
  onClose,
  onCreated,
}: Props) {
  const { toast } = useToast()

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "")
  const [contactSearch, setContactSearch] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load slots when service changes
  useEffect(() => {
    if (!serviceId) return
    setLoadingSlots(true)
    fetch(`/api/appointments/availability?service=${serviceId}&days=14`)
      .then((r) => r.json())
      .then((data) => setSlots((data.slots ?? []) as Slot[]))
      .catch(() => toast("error", "Error cargando disponibilidad"))
      .finally(() => setLoadingSlots(false))
    setSelectedSlot("")
  }, [serviceId, toast])

  // Search contacts
  useEffect(() => {
    if (contactSearch.trim().length < 2) {
      setContacts([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch)}`)
        .then((r) => r.json())
        .then((data) =>
          setContacts(
            (data.items ?? data.contacts ?? data ?? []) as Contact[]
          )
        )
        .catch(() => setContacts([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [contactSearch])

  async function handleSubmit() {
    if (!serviceId || !selectedContact || !selectedSlot) {
      toast("error", "Falta seleccionar servicio, contacto u horario")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          contact_id: selectedContact.id,
          starts_at: selectedSlot,
          notes: notes.trim() || undefined,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "Error creando cita")
        return
      }

      onCreated()
    } catch {
      toast("error", "Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by Bogota day
  const slotsByDay = slots.reduce<Map<string, Slot[]>>((acc, s) => {
    const day = s.starts_at_local.slice(0, 10)
    if (!acc.has(day)) acc.set(day, [])
    acc.get(day)!.push(s)
    return acc
  }, new Map())

  const service = services.find((s) => s.id === serviceId)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-veloce-600" />
            <h2 className="text-lg font-bold text-gray-900">Nueva cita</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Service */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Servicio
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.price_cop ? ` — $${(s.price_cop / 1000).toFixed(0)}K` : ""}
                </option>
              ))}
            </select>
            {service && (
              <p className="text-xs text-gray-500 mt-1">
                Duración: {service.duration_minutes} min
              </p>
            )}
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cliente
            </label>
            {selectedContact ? (
              <div className="flex items-center justify-between bg-veloce-50 border border-veloce-200 rounded-lg px-3 py-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedContact.first_name} {selectedContact.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedContact.whatsapp_phone ?? selectedContact.phone}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedContact(null)
                    setContactSearch("")
                  }}
                  className="text-veloce-700 text-sm hover:underline"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                    autoFocus
                  />
                </div>
                {contacts.length > 0 && (
                  <ul className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {contacts.map((c) => (
                      <li
                        key={c.id}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => setSelectedContact(c)}
                      >
                        <div className="font-medium text-gray-900">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.whatsapp_phone ?? c.phone ?? c.source}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Slot picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Horario disponible
            </label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando disponibilidad...
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay horarios disponibles en los próximos 14 días.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-3">
                {Array.from(slotsByDay.entries()).map(([day, daySlots]) => {
                  const date = new Date(day + "T12:00:00-05:00")
                  const dayLabel = date.toLocaleDateString("es-CO", {
                    timeZone: "America/Bogota",
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })
                  return (
                    <div key={day}>
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-1.5">
                        {dayLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((s) => {
                          const isSelected = selectedSlot === s.starts_at
                          const time = s.starts_at_local.slice(11)
                          return (
                            <button
                              key={s.starts_at}
                              type="button"
                              onClick={() => setSelectedSlot(s.starts_at)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                isSelected
                                  ? "bg-veloce-600 text-white border-veloce-600"
                                  : "bg-white text-gray-700 border-gray-300 hover:border-veloce-400"
                              }`}
                            >
                              {time}
                              {service?.uses_fixed_slots && s.available_capacity > 1 && (
                                <span className="ml-1 text-xs opacity-75">
                                  ({s.available_capacity})
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ej. Cliente trae Colnago V3 con grupo Shimano 105..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !serviceId ||
              !selectedContact ||
              !selectedSlot
            }
            className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg shadow-sm transition"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear cita
          </button>
        </div>
      </div>
    </div>
  )
}

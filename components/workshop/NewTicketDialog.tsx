"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Wrench, Search } from "lucide-react"
import { useToast } from "@/components/ui/Toast"

// ---------------------------------------------------------------------------
// Dialog to create a workshop ticket.
// ---------------------------------------------------------------------------

interface Contact {
  id: string
  first_name: string
  last_name: string | null
  whatsapp_phone: string | null
  phone: string | null
}

interface WorkshopService {
  id: string
  name: string
  price_cop: number | null
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function NewTicketDialog({ onClose, onCreated }: Props) {
  const { toast } = useToast()

  const [contactSearch, setContactSearch] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [services, setServices] = useState<WorkshopService[]>([])
  const [serviceType, setServiceType] = useState("")
  const [bikeDescription, setBikeDescription] = useState("")
  const [problem, setProblem] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [readyDate, setReadyDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Load workshop services
  useEffect(() => {
    fetch("/api/workshop-services")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.services ?? []) as WorkshopService[]
        setServices(list)
        if (list[0]) {
          setServiceType(list[0].name)
          if (list[0].price_cop) setEstimatedCost(String(list[0].price_cop))
        }
      })
      .catch(() => setServices([]))
  }, [])

  // Contact search
  useEffect(() => {
    if (contactSearch.trim().length < 2) {
      setContacts([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch)}`)
        .then((r) => r.json())
        .then((data) =>
          setContacts((data.items ?? data.contacts ?? []) as Contact[])
        )
        .catch(() => setContacts([]))
    }, 250)
    return () => clearTimeout(t)
  }, [contactSearch])

  function onServiceChange(name: string) {
    setServiceType(name)
    const svc = services.find((s) => s.name === name)
    if (svc?.price_cop) setEstimatedCost(String(svc.price_cop))
  }

  async function handleSubmit() {
    if (!selectedContact || !bikeDescription.trim() || !serviceType.trim()) {
      toast("error", "Falta cliente, bici o servicio")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          bike_description: bikeDescription.trim(),
          service_type: serviceType.trim(),
          problem_description: problem.trim() || undefined,
          estimated_cost_cop: estimatedCost ? parseInt(estimatedCost) : undefined,
          estimated_ready_date: readyDate || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "Error creando ticket")
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
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-veloce-600" />
            <h2 className="text-lg font-bold text-gray-900">Nuevo ticket de taller</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                    placeholder="Buscar cliente..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                    autoFocus
                  />
                </div>
                {contacts.length > 0 && (
                  <ul className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
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
                          {c.whatsapp_phone ?? c.phone}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Bike */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bicicleta
            </label>
            <input
              type="text"
              value={bikeDescription}
              onChange={(e) => setBikeDescription(e.target.value)}
              placeholder="Ej. Orbea Orca naranja, talla 54"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Service */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Servicio
            </label>
            <select
              value={serviceType}
              onChange={(e) => onServiceChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.price_cop ? ` — $${(s.price_cop / 1000).toFixed(0)}K` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Problem */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción del problema (opcional)
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              placeholder="Ej. La cadena salta en los piñones grandes, frenos rozando."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Cost + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Costo estimado (COP)
              </label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha lista (opcional)
              </label>
              <input
                type="date"
                value={readyDate}
                onChange={(e) => setReadyDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

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
              !selectedContact ||
              !bikeDescription.trim() ||
              !serviceType.trim()
            }
            className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg shadow-sm transition"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear ticket
          </button>
        </div>
      </div>
    </div>
  )
}

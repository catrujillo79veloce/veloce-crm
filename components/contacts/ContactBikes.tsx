"use client"

import { useState } from "react"
import {
  Bike,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Tag as TagIcon,
  Calendar,
  Palette,
  Ruler,
  Hash,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CustomerBike } from "@/lib/types"

// ---------------------------------------------------------------------------
// ContactBikes — registry of bikes belonging to a contact (CRUD inline)
// ---------------------------------------------------------------------------

interface ContactBikesProps {
  contactId: string
  initialBikes: CustomerBike[]
}

type Draft = {
  id?: string
  brand: string
  model: string
  year: string
  color: string
  frame_size: string
  serial_number: string
  purchase_date: string
  source: "veloce" | "external" | "unknown"
  notes: string
}

const EMPTY: Draft = {
  brand: "",
  model: "",
  year: "",
  color: "",
  frame_size: "",
  serial_number: "",
  purchase_date: "",
  source: "veloce",
  notes: "",
}

const SOURCE_LABEL: Record<string, string> = {
  veloce: "Comprada en Veloce",
  external: "Externa",
  unknown: "Origen desconocido",
}

const SOURCE_COLOR: Record<string, string> = {
  veloce: "bg-veloce-50 text-veloce-700 border-veloce-200",
  external: "bg-gray-50 text-gray-700 border-gray-200",
  unknown: "bg-amber-50 text-amber-700 border-amber-200",
}

export function ContactBikes({ contactId, initialBikes }: ContactBikesProps) {
  const [bikes, setBikes] = useState<CustomerBike[]>(initialBikes)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleSave = async () => {
    if (!editing) return
    if (!editing.brand.trim()) {
      setError("La marca es requerida")
      return
    }
    setSaving(true)
    setError("")
    try {
      const isUpdate = !!editing.id
      const res = await fetch(
        isUpdate
          ? `/api/contacts/${contactId}/bikes/${editing.id}`
          : `/api/contacts/${contactId}/bikes`,
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: editing.brand,
            model: editing.model,
            year: editing.year || null,
            color: editing.color,
            frame_size: editing.frame_size,
            serial_number: editing.serial_number,
            purchase_date: editing.purchase_date || null,
            source: editing.source,
            notes: editing.notes,
          }),
        }
      )
      const data = await res.json()
      if (!data?.success) {
        setError(data?.error ?? "Error al guardar")
        return
      }
      if (isUpdate) {
        setBikes((prev) =>
          prev.map((b) => (b.id === data.item.id ? data.item : b))
        )
      } else {
        setBikes((prev) => [data.item, ...prev])
      }
      setEditing(null)
    } catch (e) {
      console.error(e)
      setError("Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/contacts/${contactId}/bikes/${id}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (data?.success) {
      setBikes((prev) => prev.filter((b) => b.id !== id))
    }
    setDeleteId(null)
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {bikes.length === 0
            ? "Aun no hay bicicletas registradas para este contacto."
            : `${bikes.length} bicicleta${bikes.length === 1 ? "" : "s"} registrada${bikes.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={() => {
            setEditing({ ...EMPTY })
            setError("")
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-veloce-600 hover:text-veloce-700"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar bici
        </button>
      </div>

      {bikes.length > 0 && (
        <ul className="space-y-2">
          {bikes.map((b) => (
            <li
              key={b.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Bike className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {b.brand}
                      {b.model ? ` ${b.model}` : ""}
                      {b.year ? ` (${b.year})` : ""}
                    </h4>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border",
                        SOURCE_COLOR[b.source]
                      )}
                    >
                      {SOURCE_LABEL[b.source]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    {b.color && (
                      <span className="inline-flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        {b.color}
                      </span>
                    )}
                    {b.frame_size && (
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="w-3 h-3" />
                        Talla {b.frame_size}
                      </span>
                    )}
                    {b.serial_number && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Hash className="w-3 h-3" />
                        {b.serial_number}
                      </span>
                    )}
                    {b.purchase_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.purchase_date).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </div>
                  {b.notes && (
                    <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap">
                      {b.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setEditing({
                        id: b.id,
                        brand: b.brand,
                        model: b.model ?? "",
                        year: b.year ? String(b.year) : "",
                        color: b.color ?? "",
                        frame_size: b.frame_size ?? "",
                        serial_number: b.serial_number ?? "",
                        purchase_date: b.purchase_date ?? "",
                        source: b.source,
                        notes: b.notes ?? "",
                      })
                    }
                    className="p-1.5 text-gray-400 hover:text-veloce-600 rounded"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(b.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Bike className="w-4 h-4 text-amber-600" />
                {editing.id ? "Editar bici" : "Nueva bici"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">
                    Marca <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editing.brand}
                    onChange={(e) =>
                      setEditing({ ...editing, brand: e.target.value })
                    }
                    placeholder="Orbea"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Modelo</label>
                  <input
                    value={editing.model}
                    onChange={(e) =>
                      setEditing({ ...editing, model: e.target.value })
                    }
                    placeholder="Terra H50"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Año</label>
                  <input
                    type="number"
                    value={editing.year}
                    onChange={(e) =>
                      setEditing({ ...editing, year: e.target.value })
                    }
                    placeholder="2024"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Color</label>
                  <input
                    value={editing.color}
                    onChange={(e) =>
                      setEditing({ ...editing, color: e.target.value })
                    }
                    placeholder="Negro"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Talla del cuadro</label>
                  <input
                    value={editing.frame_size}
                    onChange={(e) =>
                      setEditing({ ...editing, frame_size: e.target.value })
                    }
                    placeholder="M / 54"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Fecha compra</label>
                  <input
                    type="date"
                    value={editing.purchase_date}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        purchase_date: e.target.value,
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Serial</label>
                  <input
                    value={editing.serial_number}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        serial_number: e.target.value,
                      })
                    }
                    placeholder="WTU123ABC"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Origen</label>
                  <select
                    value={editing.source}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        source: e.target.value as Draft["source"],
                      })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  >
                    <option value="veloce">Comprada en Veloce</option>
                    <option value="external">Externa</option>
                    <option value="unknown">Desconocido</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Notas</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Accesorios, observaciones, mods..."
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500 resize-y"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 bg-veloce-500 text-white text-sm rounded-lg",
                  saving ? "opacity-60 cursor-wait" : "hover:bg-veloce-600"
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-2">
              ¿Eliminar esta bicicleta?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              No se borrara el historial de servicios asociado, pero la bici
              dejara de aparecer en el perfil.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

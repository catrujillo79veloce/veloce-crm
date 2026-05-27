"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  Save,
  X,
  Tag as TagIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CannedResponse } from "@/lib/types"

interface ManagerProps {
  initialItems: CannedResponse[]
}

type DraftItem = {
  id?: string
  name: string
  body: string
  category: string
  shortcut: string
}

const EMPTY_DRAFT: DraftItem = {
  name: "",
  body: "",
  category: "general",
  shortcut: "",
}

const CATEGORIES = [
  "general",
  "tienda",
  "servicios",
  "taller",
  "ventas",
  "marketing",
]

export default function CannedResponsesManager({ initialItems }: ManagerProps) {
  const [items, setItems] = useState<CannedResponse[]>(initialItems)
  const [filter, setFilter] = useState("")
  const [editing, setEditing] = useState<DraftItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // --- Helpers ---
  const filtered = items.filter((it) => {
    const q = filter.trim().toLowerCase()
    if (!q) return true
    return (
      it.name.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      (it.shortcut ?? "").toLowerCase().includes(q) ||
      it.body.toLowerCase().includes(q)
    )
  })

  const refresh = async () => {
    const res = await fetch("/api/canned-responses")
    const data = await res.json()
    if (data?.success) setItems(data.items ?? [])
  }

  useEffect(() => {
    // Keep state fresh when navigating between pages
    refresh().catch(() => {})
  }, [])

  // --- Save (create or update) ---
  const handleSave = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.body.trim()) {
      setError("Nombre y mensaje son requeridos")
      return
    }
    setSaving(true)
    setError("")
    try {
      const isUpdate = !!editing.id
      const res = await fetch(
        isUpdate
          ? `/api/canned-responses/${editing.id}`
          : "/api/canned-responses",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editing.name,
            body: editing.body,
            category: editing.category || "general",
            shortcut: editing.shortcut || null,
          }),
        }
      )
      const data = await res.json()
      if (!data?.success) {
        setError(data?.error ?? "Error al guardar")
        return
      }
      await refresh()
      setEditing(null)
    } catch (e) {
      console.error(e)
      setError("Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/canned-responses/${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data?.success) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-veloce-500" />
            Respuestas guardadas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Plantillas que tu equipo puede insertar en el inbox con un clic o
            escribiendo /atajo
          </p>
        </div>
        <button
          onClick={() => {
            setEditing({ ...EMPTY_DRAFT })
            setError("")
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-veloce-500 text-white text-sm rounded-lg hover:bg-veloce-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre, categoria o contenido..."
          className="flex-1 outline-none text-sm placeholder:text-gray-400"
        />
        <span className="text-xs text-gray-400">
          {filtered.length} / {items.length}
        </span>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {items.length === 0
              ? "Aun no hay plantillas. Crea la primera arriba."
              : "Ninguna plantilla coincide con la busqueda."}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-left px-4 py-2 font-medium">Categoria</th>
                <th className="text-left px-4 py-2 font-medium">Atajo</th>
                <th className="text-left px-4 py-2 font-medium">Contenido</th>
                <th className="text-right px-4 py-2 font-medium w-24">Usos</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {it.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      <TagIcon className="w-2.5 h-2.5" />
                      {it.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {it.shortcut ? `/${it.shortcut}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[400px]">
                    <p className="line-clamp-2 whitespace-pre-wrap">{it.body}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {it.use_count}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() =>
                          setEditing({
                            id: it.id,
                            name: it.name,
                            body: it.body,
                            category: it.category,
                            shortcut: it.shortcut ?? "",
                          })
                        }
                        className="p-1.5 text-gray-400 hover:text-veloce-600 rounded"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(it.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit/Create modal */}
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {editing.id ? "Editar plantilla" : "Nueva plantilla"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    placeholder="Ej: Horarios"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Categoria
                  </label>
                  <select
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Atajo (opcional)
                </label>
                <input
                  value={editing.shortcut}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      shortcut: e.target.value
                        .replace(/[^a-zA-Z0-9-]/g, "")
                        .toLowerCase(),
                    })
                  }
                  placeholder="horarios"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Se invocara escribiendo /{editing.shortcut || "atajo"} en el
                  composer.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Mensaje <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editing.body}
                  onChange={(e) =>
                    setEditing({ ...editing, body: e.target.value })
                  }
                  rows={8}
                  placeholder="Escribe el texto que se insertara..."
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500 resize-y font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Puedes usar emojis y saltos de linea. Se enviara tal cual.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
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
                  saving
                    ? "opacity-60 cursor-wait"
                    : "hover:bg-veloce-600"
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
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-gray-900 mb-2">
              ¿Eliminar plantilla?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Esta accion no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
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

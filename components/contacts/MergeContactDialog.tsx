"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  GitMerge,
  X,
  Search,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui"
import type { Contact } from "@/lib/types"

interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  whatsapp_phone: string | null
  facebook_id: string | null
  instagram_id: string | null
  source: string | null
  status: string | null
  avatar_url: string | null
  created_at: string
  matched_on: string[]
}

interface MergeContactDialogProps {
  keeperContact: Contact
  open: boolean
  onClose: () => void
}

const MATCH_LABEL: Record<string, string> = {
  telefono: "Mismo telefono",
  email: "Mismo email",
  instagram: "Mismo Instagram",
  facebook: "Mismo Facebook",
  "nombre+ciudad": "Mismo nombre y ciudad",
}

export default function MergeContactDialog({
  keeperContact,
  open,
  onClose,
}: MergeContactDialogProps) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState("")

  // Load auto-detected duplicates when dialog opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError("")
    fetch(`/api/contacts/${keeperContact.id}/duplicates`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.success) setCandidates(d.candidates ?? [])
      })
      .catch((e) => console.error("Load duplicates error:", e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, keeperContact.id])

  // Manual search by name/phone/email
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const ctl = new AbortController()
    setSearching(true)
    const q = encodeURIComponent(searchQuery.trim())
    fetch(`/api/contacts/search?q=${q}&exclude=${keeperContact.id}`, {
      signal: ctl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setSearchResults(d.items ?? [])
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          console.error("Search contacts error:", e)
      })
      .finally(() => setSearching(false))
    return () => ctl.abort()
  }, [searchQuery, keeperContact.id])

  const handleMerge = async () => {
    if (!selected) return
    if (
      !confirm(
        `Vas a fusionar "${selected.first_name} ${selected.last_name}" dentro de "${keeperContact.first_name} ${keeperContact.last_name}". El primero se ELIMINA y todos sus mensajes, leads, deals, notas y etiquetas pasan al segundo. ¿Continuar?`
      )
    ) {
      return
    }
    setMerging(true)
    setError("")
    try {
      const res = await fetch(`/api/contacts/${keeperContact.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateId: selected.id }),
      })
      const d = await res.json()
      if (!d?.success) {
        setError(d?.error ?? "Error al fusionar")
      } else {
        // Refresh the contact page so the merged data shows
        router.refresh()
        onClose()
      }
    } catch (e) {
      console.error(e)
      setError("Error de conexion")
    } finally {
      setMerging(false)
    }
  }

  if (!open) return null

  const displayList = searchQuery.trim().length >= 2 ? searchResults : candidates

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-veloce-600" />
            <h2 className="font-semibold text-gray-900">Combinar contacto</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{keeperContact.first_name} {keeperContact.last_name}</strong>{" "}
            sobrevive. El contacto que elijas se ELIMINA, pero sus mensajes,
            leads, deals, notas y etiquetas se mueven al sobreviviente. No se
            puede deshacer.
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Manual search */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Buscar otro contacto
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre, telefono o email..."
                className="flex-1 outline-none text-sm bg-transparent"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Candidates list */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">
              {searchQuery.trim().length >= 2
                ? `Resultados (${searchResults.length})`
                : `Sugerencias automaticas (${candidates.length})`}
            </p>

            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando duplicados...
              </div>
            ) : displayList.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {searchQuery.trim().length >= 2
                  ? "Ningun contacto coincide."
                  : "No detectamos duplicados automaticamente. Usa la busqueda manual arriba."}
              </div>
            ) : (
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {displayList.map((c) => {
                  const isSelected = selected?.id === c.id
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                          isSelected
                            ? "bg-veloce-50 border-veloce-300"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <Avatar
                          src={c.avatar_url}
                          firstName={c.first_name}
                          lastName={c.last_name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {c.first_name} {c.last_name}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-veloce-600" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {c.whatsapp_phone || c.phone || c.email || c.instagram_id || c.facebook_id || "Sin contacto"}
                          </p>
                          {c.matched_on && c.matched_on.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.matched_on.map((m) => (
                                <span
                                  key={m}
                                  className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5"
                                >
                                  {MATCH_LABEL[m] ?? m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Preview of merge */}
          {selected && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Vista previa
              </p>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="font-medium text-red-900">
                    {selected.first_name} {selected.last_name}
                  </p>
                  <p className="text-red-600 text-[10px]">Se elimina</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="font-medium text-green-900">
                    {keeperContact.first_name} {keeperContact.last_name}
                  </p>
                  <p className="text-green-700 text-[10px]">Recibe los datos</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={merging}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleMerge}
            disabled={!selected || merging}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors",
              !selected || merging
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-veloce-500 hover:bg-veloce-600"
            )}
          >
            <GitMerge className="w-4 h-4" />
            {merging ? "Fusionando..." : "Fusionar"}
          </button>
        </div>
      </div>
    </div>
  )
}

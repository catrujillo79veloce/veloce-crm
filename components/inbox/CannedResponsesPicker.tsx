"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, X, Search, Tag as TagIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CannedResponse } from "@/lib/types"

// ---------------------------------------------------------------------------
// CannedResponsesPicker
// Popover that opens above the message composer. Lists templates, supports
// fuzzy filtering by name / category / shortcut. Click or Enter inserts the
// template body via onPick.
// ---------------------------------------------------------------------------

interface PickerProps {
  open: boolean
  initialFilter?: string
  onClose: () => void
  onPick: (item: CannedResponse) => void
}

export default function CannedResponsesPicker({
  open,
  initialFilter,
  onClose,
  onPick,
}: PickerProps) {
  const [items, setItems] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState(initialFilter ?? "")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // --- Load on open ---
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch("/api/canned-responses")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success) setItems(data.items ?? [])
      })
      .catch((e) => console.error("Load canned error:", e))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setFilter(initialFilter ?? "")
      setActiveIndex(0)
      // Autofocus the search after open animation
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open, initialFilter])

  // --- Fuzzy filter (name, body excerpt, category, shortcut) ---
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay =
        `${it.name} ${it.category} ${it.shortcut ?? ""} ${it.body.slice(0, 200)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, filter])

  // Reset highlight when filter results change
  useEffect(() => {
    setActiveIndex(0)
  }, [filter, items.length])

  // Keep highlighted item in view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  // --- Insertion path ---
  const handlePick = async (item: CannedResponse) => {
    onPick(item)
    // Fire-and-forget popularity increment (no need to await)
    fetch(`/api/canned-responses/${item.id}/use`, { method: "POST" }).catch(
      () => {}
    )
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const pick = filtered[activeIndex]
      if (pick) void handlePick(pick)
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 px-4 z-30 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-xl shadow-xl border border-gray-200 max-h-[360px] flex flex-col overflow-hidden">
        {/* Header / search */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <Sparkles className="w-4 h-4 text-veloce-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-600">
            Respuestas guardadas
          </span>
          <div className="flex-1 flex items-center gap-1.5 ml-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar (nombre, categoria, shortcut)..."
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
          onKeyDown={handleKeyDown}
        >
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">
              Cargando plantillas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              {filter
                ? "Ninguna plantilla coincide."
                : "Aun no hay plantillas. Crealas en Configuracion > Respuestas guardadas."}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handlePick(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors",
                  idx === activeIndex ? "bg-veloce-50" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </span>
                    {item.shortcut && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        /{item.shortcut}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    <TagIcon className="w-2.5 h-2.5" />
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 leading-snug whitespace-pre-wrap">
                  {item.body}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
          <span>↑↓ navegar · Enter insertar · Esc cerrar</span>
          <a
            href="/settings/canned-responses"
            className="text-veloce-600 hover:text-veloce-700"
          >
            Administrar →
          </a>
        </div>
      </div>
    </div>
  )
}

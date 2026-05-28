"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X, Tag as TagIcon, Loader2 } from "lucide-react"

// ---------------------------------------------------------------------------
// ContactTagsBar
// Shows a contact's tags as colored chips in the conversation header, with
// one-click add (from the catalog of tags) and remove. Feeds pipeline +
// marketing segmentation.
// ---------------------------------------------------------------------------

interface Tag {
  id: string
  name: string
  color: string | null
  source?: string
}

export default function ContactTagsBar({ contactId }: { contactId: string }) {
  const [applied, setApplied] = useState<Tag[]>([])
  const [available, setAvailable] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/contacts/${contactId}/tags`)
      .then((r) => r.json())
      .then((d) => {
        setApplied(d.applied ?? [])
        setAvailable(d.available ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contactId])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function addTag(tag: Tag) {
    setBusy(true)
    setApplied((prev) => [...prev, { ...tag, source: "manual" }])
    setOpen(false)
    try {
      await fetch(`/api/contacts/${contactId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id }),
      })
    } catch {
      setApplied((prev) => prev.filter((t) => t.id !== tag.id))
    } finally {
      setBusy(false)
    }
  }

  async function removeTag(tag: Tag) {
    setBusy(true)
    setApplied((prev) => prev.filter((t) => t.id !== tag.id))
    try {
      await fetch(`/api/contacts/${contactId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id }),
      })
    } catch {
      setApplied((prev) => [...prev, tag])
    } finally {
      setBusy(false)
    }
  }

  const appliedIds = new Set(applied.map((t) => t.id))
  const addable = available.filter((t) => !appliedIds.has(t.id))

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-gray-300">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {applied.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: t.color ?? "#6b7280" }}
        >
          {t.name}
          <button
            onClick={() => removeTag(t)}
            disabled={busy}
            className="hover:bg-black/20 rounded-full"
            title="Quitar etiqueta"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Add tag */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-veloce-400 hover:text-veloce-600"
        >
          <Plus className="w-3 h-3" />
          Etiqueta
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">
                Todas las etiquetas aplicadas
              </p>
            ) : (
              <ul className="py-1">
                {addable.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => addTag(t)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color ?? "#6b7280" }}
                      />
                      <span className="truncate text-gray-700">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

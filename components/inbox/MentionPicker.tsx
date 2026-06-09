"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/ui"

export interface MentionablePerson {
  id: string
  full_name: string
  avatar_url: string | null
}

interface MentionPickerProps {
  open: boolean
  query: string
  members: MentionablePerson[]
  onClose: () => void
  onPick: (member: MentionablePerson) => void
}

// ---------------------------------------------------------------------------
// MentionPicker — small popover anchored above the composer textarea. Lists
// team members matching `query` (the partial token after "@"). Keyboard:
// ArrowUp/Down to navigate, Enter to pick, Escape to close.
// ---------------------------------------------------------------------------

export default function MentionPicker({
  open,
  query,
  members,
  onClose,
  onPick,
}: MentionPickerProps) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return members.slice(0, 6)
    return members
      .filter((m) => m.full_name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [members, query])

  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === "Enter" || e.key === "Tab") {
        const pick = filtered[highlight]
        if (pick) {
          e.preventDefault()
          onPick(pick)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, highlight, filtered, onPick, onClose])

  if (!open || filtered.length === 0) return null

  return (
    <div className="absolute left-4 right-4 bottom-full mb-1 z-30">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-w-xs">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
          Mencionar a
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(m)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left " +
                  (i === highlight ? "bg-veloce-50" : "hover:bg-gray-50")
                }
              >
                <Avatar
                  src={m.avatar_url}
                  firstName={m.full_name.split(" ")[0]}
                  lastName={m.full_name.split(" ")[1] ?? ""}
                  size="sm"
                />
                <span className="text-sm text-gray-800 truncate">
                  {m.full_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

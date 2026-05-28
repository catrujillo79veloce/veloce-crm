"use client"

import { useEffect, useRef } from "react"

// ---------------------------------------------------------------------------
// Lightweight emoji picker (no external lib). Curated set grouped by theme,
// tuned for a bike shop's customer chat.
// ---------------------------------------------------------------------------

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Caras",
    emojis: ["😀", "😃", "😁", "😊", "😉", "😍", "🤩", "😎", "🙂", "😅", "🤗", "🤔", "😌", "😴", "🥳", "😇"],
  },
  {
    label: "Gestos",
    emojis: ["👍", "👏", "🙌", "🙏", "💪", "🤝", "👌", "✌️", "🫶", "👋", "🤙", "✅", "❌", "⭐", "🔥", "✨"],
  },
  {
    label: "Corazones",
    emojis: ["❤️", "💚", "💙", "💛", "🧡", "💜", "🤍", "💯", "🎉", "🎁", "🥇", "🏆"],
  },
  {
    label: "Ciclismo",
    emojis: ["🚴", "🚵", "🚲", "⛰️", "🏁", "🛠️", "⚙️", "🧰", "💨", "🌄", "☀️", "💧", "📍", "📲", "💰", "🛒"],
  },
]

interface Props {
  open: boolean
  onClose: () => void
  onPick: (emoji: string) => void
}

export default function EmojiPicker({ open, onClose, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 ml-4 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2 max-h-72 overflow-y-auto"
    >
      {GROUPS.map((g) => (
        <div key={g.label} className="mb-2 last:mb-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1 mb-1">
            {g.label}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {g.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onPick(e)}
                className="text-xl leading-none p-1 rounded hover:bg-gray-100"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, User, Package, Bookmark, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Global search box for the top bar. Debounced query against /api/search,
// categorized dropdown, keyboard nav, click/Enter to navigate.
// ---------------------------------------------------------------------------

interface Hit {
  type: "contact" | "product" | "reservation" | "ticket"
  id: string
  title: string
  subtitle: string
  href: string
}

const TYPE_META: Record<
  Hit["type"],
  { icon: React.ElementType; label: string; color: string }
> = {
  contact: { icon: User, label: "Contacto", color: "text-blue-500" },
  product: { icon: Package, label: "Producto", color: "text-veloce-600" },
  reservation: { icon: Bookmark, label: "Reserva", color: "text-purple-500" },
  ticket: { icon: Wrench, label: "Taller", color: "text-amber-500" },
}

export default function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      setOpen(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          setHits((data.hits ?? []) as Hit[])
          setOpen(true)
          setActive(0)
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, 220)
    return () => clearTimeout(t)
  }, [q])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function go(hit: Hit) {
    setOpen(false)
    setQ("")
    setHits([])
    router.push(hit.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (hits[active]) go(hits[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        size={16}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg",
          "placeholder:text-gray-400 text-gray-900",
          "focus:outline-none focus:ring-2 focus:ring-veloce-500/20 focus:border-veloce-500",
          "transition-colors"
        )}
        aria-label="Global search"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
      )}

      {open && (
        <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              {loading ? "Buscando..." : "Sin resultados"}
            </p>
          ) : (
            <ul>
              {hits.map((hit, i) => {
                const meta = TYPE_META[hit.type]
                const Icon = meta.icon
                return (
                  <li key={`${hit.type}-${hit.id}`}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        i === active ? "bg-gray-50" : "hover:bg-gray-50"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", meta.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {hit.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {hit.subtitle}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 flex-shrink-0">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

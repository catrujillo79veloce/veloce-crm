"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Loader2, Package } from "lucide-react"

// ---------------------------------------------------------------------------
// ProductPickerPopover
// Popover above the composer to search the product catalog and pick one to
// send into the conversation. Returns the chosen product to the parent.
// ---------------------------------------------------------------------------

export interface PickedProduct {
  id: string
  name: string
  brand: string | null
  price: number
  sale_price: number | null
  image_url: string | null
  external_url: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onPick: (product: PickedProduct) => void
}

function fmtCop(n: number): string {
  return "$" + Number(n).toLocaleString("es-CO")
}

export default function ProductPickerPopover({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState("")
  const [items, setItems] = useState<PickedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load on open (empty query → top products) and on query change
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const url = q.trim()
      ? `/api/products/search?q=${encodeURIComponent(q)}&limit=12`
      : `/api/products/search?q=&limit=12`
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => setItems((data.items ?? []) as PickedProduct[]))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50"
    >
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto del catálogo..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>
        ) : (
          <ul>
            {items.map((p) => {
              const price = p.sale_price ?? p.price
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-b-0"
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.brand ? `${p.brand} ` : ""}
                        {p.name}
                      </p>
                      <p className="text-xs">
                        {p.sale_price ? (
                          <>
                            <span className="text-veloce-600 font-semibold">
                              {fmtCop(p.sale_price)}
                            </span>{" "}
                            <span className="text-gray-400 line-through">
                              {fmtCop(p.price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-veloce-600 font-semibold">
                            {fmtCop(price)}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

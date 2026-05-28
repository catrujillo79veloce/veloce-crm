"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Bookmark, Search } from "lucide-react"
import { useToast } from "@/components/ui/Toast"

// ---------------------------------------------------------------------------
// Dialog to create a reservation (separar bici).
// ---------------------------------------------------------------------------

interface Contact {
  id: string
  first_name: string
  last_name: string | null
  whatsapp_phone: string | null
  phone: string | null
}

interface Product {
  id: string
  name: string
  brand: string | null
  price: number
  sale_price: number | null
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function NewReservationDialog({ onClose, onCreated }: Props) {
  const { toast } = useToast()

  const [contactSearch, setContactSearch] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [productName, setProductName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)

  const [totalPrice, setTotalPrice] = useState("")
  const [depositPct, setDepositPct] = useState("30")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

  // Product search
  useEffect(() => {
    if (productSearch.trim().length < 2) {
      setProducts([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=8`)
        .then((r) => r.json())
        .then((data) => setProducts((data.items ?? []) as Product[]))
        .catch(() => setProducts([]))
    }, 250)
    return () => clearTimeout(t)
  }, [productSearch])

  function selectProduct(p: Product) {
    setProductId(p.id)
    setProductName(p.name)
    setTotalPrice(String(p.sale_price ?? p.price))
    setProducts([])
    setProductSearch("")
  }

  const total = parseInt(totalPrice) || 0
  const pct = parseFloat(depositPct) || 0
  const depositPreview = Math.round((total * pct) / 100)
  const balancePreview = total - depositPreview

  async function handleSubmit() {
    if (!selectedContact || !productName.trim() || total <= 0) {
      toast("error", "Falta cliente, producto o valor")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          product_id: productId,
          product_name: productName.trim(),
          total_price_cop: total,
          deposit_pct: pct,
          notes: notes.trim() || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast("error", body.error ?? "Error creando reserva")
        return
      }
      onCreated()
    } catch {
      toast("error", "Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  const fmtCop = (n: number) => "$" + n.toLocaleString("es-CO")

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
            <Bookmark className="h-5 w-5 text-veloce-600" />
            <h2 className="text-lg font-bold text-gray-900">Separar bici</h2>
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

          {/* Product */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Producto
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar en catálogo (o escribe abajo manualmente)..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            {products.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => selectProduct(p)}
                  >
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {fmtCop(p.sale_price ?? p.price)}
                      {p.sale_price && (
                        <span className="line-through ml-2 text-gray-400">
                          {fmtCop(p.price)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <input
              type="text"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value)
                setProductId(null)
              }}
              placeholder="Nombre del producto a reservar"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Price + deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Valor total (COP)
              </label>
              <input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Abono (%)
              </label>
              <input
                type="number"
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
                min={0}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Preview */}
          {total > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Abono a pagar ahora:</span>
                <span className="font-semibold text-green-600">
                  {fmtCop(depositPreview)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Saldo al recoger:</span>
                <span className="font-semibold text-gray-900">
                  {fmtCop(balancePreview)}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej. Talla 54, color negro. Cliente recoge el sábado."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
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
            disabled={submitting || !selectedContact || !productName.trim() || total <= 0}
            className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg shadow-sm transition"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear reserva
          </button>
        </div>
      </div>
    </div>
  )
}

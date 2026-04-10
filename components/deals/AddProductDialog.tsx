"use client"

import React, { useState, useEffect, useTransition } from "react"
import { Search, Package } from "lucide-react"
import { Dialog, Button, Input } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency } from "@/lib/utils"
import { searchProducts } from "@/app/actions/products"
import { addProductToDeal } from "@/app/actions/deals"
import type { Product } from "@/lib/types"

interface AddProductDialogProps {
  open: boolean
  onClose: () => void
  dealId: string
  onSuccess: () => void
}

export function AddProductDialog({
  open,
  onClose,
  dealId,
  onSuccess,
}: AddProductDialogProps) {
  const { locale } = useI18n()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [discount, setDiscount] = useState("0")

  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setProducts([])
      setSelectedProduct(null)
      setQuantity("1")
      setUnitPrice("")
      setDiscount("0")
    }
  }, [open])

  useEffect(() => {
    if (searchQuery.length < 2) {
      setProducts([])
      return
    }

    const timer = setTimeout(async () => {
      const results = await searchProducts(searchQuery)
      setProducts(results)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setUnitPrice(product.price.toString())
    setSearchQuery("")
    setProducts([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return

    startTransition(async () => {
      const result = await addProductToDeal(
        dealId,
        selectedProduct.id,
        parseInt(quantity) || 1,
        parseFloat(unitPrice) || selectedProduct.price,
        parseFloat(discount) || 0
      )

      if (result.success) {
        toast(
          "success",
          locale === "es" ? "Producto agregado" : "Product added"
        )
        onSuccess()
        onClose()
      } else {
        toast("error", result.error || "Error")
      }
    })
  }

  const qty = parseInt(quantity) || 0
  const price = parseFloat(unitPrice) || 0
  const disc = parseFloat(discount) || 0
  const lineTotal = qty * price * (1 - disc / 100)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={locale === "es" ? "Agregar Producto" : "Add Product"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!selectedProduct ? (
          <div className="space-y-2">
            <Input
              label={locale === "es" ? "Buscar producto" : "Search product"}
              icon={<Search className="h-4 w-4" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === "es"
                  ? "Escribe para buscar..."
                  : "Type to search..."
              }
              autoFocus
            />

            {products.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Package className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      {product.brand && (
                        <p className="text-xs text-gray-500">{product.brand}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 shrink-0">
                      {formatCurrency(product.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedProduct.name}
                </p>
                {selectedProduct.brand && (
                  <p className="text-xs text-gray-500">
                    {selectedProduct.brand}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-xs text-veloce-600 hover:underline"
              >
                {locale === "es" ? "Cambiar" : "Change"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label={locale === "es" ? "Cantidad" : "Quantity"}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
              <Input
                label={locale === "es" ? "Precio Unitario" : "Unit Price"}
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                min="0"
              />
              <Input
                label={`${locale === "es" ? "Descuento" : "Discount"} (%)`}
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
                max="100"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-veloce-50 p-3">
              <span className="text-sm font-medium text-gray-700">
                {locale === "es" ? "Total Linea" : "Line Total"}
              </span>
              <span className="text-lg font-bold text-veloce-700">
                {formatCurrency(lineTotal)}
              </span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            {locale === "es" ? "Cancelar" : "Cancel"}
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={!selectedProduct}
          >
            {locale === "es" ? "Agregar" : "Add"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

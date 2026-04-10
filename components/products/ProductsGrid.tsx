"use client"

import React, { useState, useTransition, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Package,
  Edit3,
  Power,
  PowerOff,
  Plus,
  Search,

} from "lucide-react"
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Select,
  EmptyState,
} from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency, cn } from "@/lib/utils"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import { toggleProductActive } from "@/app/actions/products"
import { ProductForm } from "./ProductForm"
import type { Product } from "@/lib/types"

interface ProductsGridProps {
  products: Product[]
  total: number
}

export function ProductsGrid({ products, total }: ProductsGridProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState(searchParams.get("search") || "")

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set("search", value)
      } else {
        params.delete("search")
      }
      router.push(`/products?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleCategoryFilter = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (category) {
        params.set("category", category)
      } else {
        params.delete("category")
      }
      router.push(`/products?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleToggleActive = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await toggleProductActive(id)
        if (result.success) {
          toast(
            "success",
            locale === "es" ? "Estado actualizado" : "Status updated"
          )
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [locale, router, toast]
  )

  const handleFormSuccess = useCallback(() => {
    setShowForm(false)
    setEditProduct(null)
    router.refresh()
  }, [router])

  const categoryOptions = [
    { value: "", label: locale === "es" ? "Todas" : "All" },
    ...PRODUCT_CATEGORIES.map((c) => ({
      value: c.value,
      label: c.label[locale],
    })),
  ]

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t.products.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {total} {locale === "es" ? "productos" : "products"}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            {t.products.newProduct}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input
              icon={<Search className="h-4 w-4" />}
              placeholder={
                locale === "es"
                  ? "Buscar productos..."
                  : "Search products..."
              }
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={categoryOptions}
              value={searchParams.get("category") || ""}
              onChange={(e) => handleCategoryFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-12 w-12" />}
            title={t.products.noProducts}
            description={
              locale === "es"
                ? "Agrega tu primer producto"
                : "Add your first product"
            }
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                {t.products.newProduct}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => {
              const categoryConfig = PRODUCT_CATEGORIES.find(
                (c) => c.value === product.category
              )
              return (
                <Card key={product.id} className="overflow-hidden">
                  {/* Image area */}
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-12 w-12 text-gray-300" />
                      </div>
                    )}

                    {/* Active badge */}
                    {!product.is_active && (
                      <div className="absolute top-2 right-2">
                        <Badge color="#6b7280" className="text-[10px]">
                          {locale === "es" ? "Inactivo" : "Inactive"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent>
                    <div className="space-y-2">
                      {/* Category badge */}
                      {categoryConfig && (
                        <Badge className="text-[10px]">
                          {categoryConfig.label[locale]}
                        </Badge>
                      )}

                      {/* Name + brand */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        {product.brand && (
                          <p className="text-xs text-gray-500">
                            {product.brand}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <p className="text-base font-bold text-gray-900">
                        {formatCurrency(product.price)}
                      </p>

                      {/* Stock */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            product.in_stock
                              ? "bg-green-500"
                              : "bg-red-500"
                          )}
                        />
                        <span className="text-xs text-gray-500">
                          {product.in_stock
                            ? `${t.products.inStock} (${product.stock_quantity})`
                            : t.products.outOfStock}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditProduct(product)
                            setShowForm(true)
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          {t.common.edit}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          onClick={() => handleToggleActive(product.id)}
                          disabled={isPending}
                          aria-label={
                            product.is_active
                              ? locale === "es"
                                ? "Desactivar"
                                : "Deactivate"
                              : locale === "es"
                                ? "Activar"
                                : "Activate"
                          }
                        >
                          {product.is_active ? (
                            <PowerOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Power className="h-4 w-4 text-veloce-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ProductForm
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditProduct(null)
        }}
        onSuccess={handleFormSuccess}
        product={editProduct}
      />
    </>
  )
}

"use client"

import React, { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  DollarSign,
  User,
  Percent,
  CalendarDays,
  Package,
  Trash2,
  Plus,
  StickyNote,
} from "lucide-react"
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DEAL_STAGES } from "@/lib/constants"
import { removeProductFromDeal } from "@/app/actions/deals"
import { AddProductDialog } from "@/components/deals/AddProductDialog"
import { NotesList } from "@/components/notes/NotesList"
import type { Deal, Note } from "@/lib/types"

interface DealDetailProps {
  deal: Deal
  notes: Note[]
}

export default function DealDetail({ deal, notes }: DealDetailProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showAddProduct, setShowAddProduct] = useState(false)

  const stageConfig = DEAL_STAGES.find((s) => s.value === deal.stage)

  const handleRemoveProduct = useCallback(
    (dealProductId: string) => {
      startTransition(async () => {
        const result = await removeProductFromDeal(dealProductId)
        if (result.success) {
          toast(
            "success",
            locale === "es" ? "Producto eliminado" : "Product removed"
          )
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [locale, router, toast]
  )

  const productsTotal =
    deal.products?.reduce((sum, dp) => sum + dp.total, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => router.push("/deals")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
            <div className="mt-1 flex items-center gap-3">
              {stageConfig && (
                <Badge color={stageConfig.color}>
                  {stageConfig.label[locale]}
                </Badge>
              )}
              {deal.contact && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <User className="h-3.5 w-3.5" />
                  {deal.contact.first_name} {deal.contact.last_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="h-4 w-4" />
            {t.deals.amount}
          </div>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(deal.amount)}
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Percent className="h-4 w-4" />
            {t.deals.probability}
          </div>
          <p className="text-lg font-bold text-gray-900">
            {deal.probability}%
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <CalendarDays className="h-4 w-4" />
            {locale === "es" ? "Cierre Esperado" : "Expected Close"}
          </div>
          <p className="text-lg font-bold text-gray-900">
            {deal.expected_close_date
              ? formatDate(deal.expected_close_date, locale)
              : "-"}
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Package className="h-4 w-4" />
            {t.deals.products}
          </div>
          <p className="text-lg font-bold text-gray-900">
            {deal.products?.length || 0}
          </p>
        </Card>
      </div>

      {/* Products section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                {t.deals.products}
              </h2>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddProduct(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.deals.addProduct}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {deal.products && deal.products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-2.5 font-medium text-gray-500">
                      {locale === "es" ? "Producto" : "Product"}
                    </th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 text-right">
                      {locale === "es" ? "Cant." : "Qty"}
                    </th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 text-right">
                      {locale === "es" ? "Precio Unit." : "Unit Price"}
                    </th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 text-right">
                      {locale === "es" ? "Desc. %" : "Disc. %"}
                    </th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 text-right">
                      Total
                    </th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deal.products.map((dp) => (
                    <tr key={dp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">
                          {dp.product?.name || "---"}
                        </p>
                        {dp.product?.brand && (
                          <p className="text-xs text-gray-500">
                            {dp.product.brand}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {dp.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {formatCurrency(dp.unit_price)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {dp.discount_percent}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        {formatCurrency(dp.total)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(dp.id)}
                          disabled={isPending}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                          aria-label={
                            locale === "es"
                              ? "Eliminar producto"
                              : "Remove product"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td
                      colSpan={4}
                      className="px-4 py-2.5 text-right font-semibold text-gray-700"
                    >
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right text-lg font-bold text-veloce-700">
                      {formatCurrency(productsTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              <Package className="mx-auto mb-2 h-8 w-8" />
              {locale === "es"
                ? "No hay productos en esta venta"
                : "No products in this deal"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              {locale === "es" ? "Notas" : "Notes"}
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <NotesList
            notes={notes}
            dealId={deal.id}
          />
        </CardContent>
      </Card>

      <AddProductDialog
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        dealId={deal.id}
        onSuccess={() => {
          setShowAddProduct(false)
          router.refresh()
        }}
      />
    </div>
  )
}

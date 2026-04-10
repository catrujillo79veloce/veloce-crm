"use client"

import React, { useState, useCallback, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, User, Percent, Plus, GripVertical } from "lucide-react"
import { KanbanBoard, type KanbanColumnData } from "@/components/pipeline"
import { Badge, Button } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency } from "@/lib/utils"
import { DEAL_STAGES } from "@/lib/constants"
import { updateDealStage } from "@/app/actions/deals"
import { DealForm } from "./DealForm"
import type { Deal, DealStage } from "@/lib/types"
import type { DealsGroupedByStage } from "@/app/actions/deals"

interface DealKanbanProps {
  initialDeals: DealsGroupedByStage
}

export function DealKanban({ initialDeals }: DealKanbanProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [deals, setDeals] = useState<DealsGroupedByStage>(initialDeals)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const columns: KanbanColumnData<Deal>[] = useMemo(
    () =>
      DEAL_STAGES.map((stage) => {
        const stageDeals = deals[stage.value] || []
        const stageTotal = stageDeals.reduce(
          (sum, d) => sum + (d.amount || 0),
          0
        )
        return {
          id: stage.value,
          title: stage.label[locale],
          color: stage.color,
          items: stageDeals,
          sumLabel: stageTotal > 0 ? formatCurrency(stageTotal) : undefined,
        }
      }),
    [deals, locale]
  )

  const handleCardMove = useCallback(
    (cardId: string, newColumnId: string, newPosition: number) => {
      const newStage = newColumnId as DealStage

      // Find and move the deal optimistically
      let movedDeal: Deal | null = null
      const updatedDeals = { ...deals }

      for (const stage of Object.keys(updatedDeals)) {
        const index = updatedDeals[stage].findIndex((d) => d.id === cardId)
        if (index !== -1) {
          movedDeal = { ...updatedDeals[stage][index] }
          updatedDeals[stage] = updatedDeals[stage].filter(
            (d) => d.id !== cardId
          )
          break
        }
      }

      if (!movedDeal) return

      movedDeal.stage = newStage
      if (!updatedDeals[newStage]) {
        updatedDeals[newStage] = []
      }

      const arr = [...updatedDeals[newStage]]
      arr.splice(newPosition, 0, movedDeal)
      updatedDeals[newStage] = arr

      setDeals(updatedDeals)

      startTransition(async () => {
        const result = await updateDealStage(cardId, newStage, newPosition)
        if (!result.success) {
          toast(
            "error",
            result.error ||
              (locale === "es"
                ? "Error al mover la venta"
                : "Error moving deal")
          )
          setDeals(initialDeals)
        } else {
          router.refresh()
        }
      })
    },
    [deals, initialDeals, locale, router, toast]
  )

  const handleCardClick = useCallback(
    (dealId: string) => {
      router.push(`/deals/${dealId}`)
    },
    [router]
  )

  const handleDealCreated = useCallback(() => {
    setShowCreateForm(false)
    router.refresh()
  }, [router])

  const renderDealCard = useCallback(
    (deal: Deal) => (
      <div
        className="space-y-2 cursor-pointer"
        onClick={() => handleCardClick(deal.id)}
        role="button"
        tabIndex={0}
        aria-label={deal.title}
      >
        {/* Drag handle */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-gray-300" />
        </div>

        <p className="text-sm font-medium text-gray-900 truncate pr-4">
          {deal.title}
        </p>

        {deal.contact && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span className="truncate">
              {deal.contact.first_name} {deal.contact.last_name}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-900">
            <DollarSign className="h-3 w-3 text-veloce-500" />
            {formatCurrency(deal.amount)}
          </div>
          <Badge
            className="text-[10px]"
            color={
              deal.probability >= 70
                ? "#22c55e"
                : deal.probability >= 40
                  ? "#f59e0b"
                  : "#6b7280"
            }
          >
            <Percent className="mr-0.5 h-2.5 w-2.5" />
            {deal.probability}
          </Badge>
        </div>
      </div>
    ),
    [handleCardClick]
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.deals.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "es"
              ? "Gestiona tu pipeline de ventas"
              : "Manage your sales pipeline"}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4" />
          {t.deals.newDeal}
        </Button>
      </div>

      <KanbanBoard<Deal>
        columns={columns}
        onCardMove={handleCardMove}
        renderCard={renderDealCard}
      />

      <DealForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSuccess={handleDealCreated}
      />
    </>
  )
}

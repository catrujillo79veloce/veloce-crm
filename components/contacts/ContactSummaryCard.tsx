"use client"

import { useMemo } from "react"
import {
  DollarSign,
  ShoppingBag,
  MessageCircle,
  Calendar,
  Bike,
  TrendingUp,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Deal, Interaction } from "@/lib/types"

interface ContactSummaryCardProps {
  deals: Deal[]
  interactions: Interaction[]
  interactionCount: number
  bikesCount: number
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

// ---------------------------------------------------------------------------
// ContactSummaryCard
// At-a-glance metrics shown above ContactQuickActions in the left column of
// the contact 360 view: total spent, # purchases, # messages, last activity,
// # of bikes registered, average deal value.
// ---------------------------------------------------------------------------

export function ContactSummaryCard({
  deals,
  interactions,
  interactionCount,
  bikesCount,
}: ContactSummaryCardProps) {
  const metrics = useMemo(() => {
    const closedWon = deals.filter((d) => d.stage === "closed_won")
    const totalSpent = closedWon.reduce(
      (sum, d) => sum + (d.amount ?? 0),
      0
    )
    const avgDeal =
      closedWon.length > 0 ? totalSpent / closedWon.length : 0

    const lastInteraction = interactions[0]
    const lastInboundInteraction = interactions.find(
      (i) => i.direction === "inbound"
    )

    return {
      totalSpent,
      purchasesCount: closedWon.length,
      avgDeal,
      lastInteractionAt: lastInteraction?.occurred_at,
      lastInboundAt: lastInboundInteraction?.occurred_at,
    }
  }, [deals, interactions])

  const items = [
    {
      label: "Total gastado",
      value: CURRENCY_FORMATTER.format(metrics.totalSpent),
      sub: metrics.purchasesCount
        ? `${metrics.purchasesCount} compra${metrics.purchasesCount === 1 ? "" : "s"}`
        : "Sin compras aun",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Promedio por compra",
      value:
        metrics.avgDeal > 0
          ? CURRENCY_FORMATTER.format(metrics.avgDeal)
          : "—",
      sub:
        metrics.avgDeal > 0 ? "Ticket promedio" : "Necesitas al menos 1 venta",
      icon: TrendingUp,
      color: "text-veloce-600",
      bg: "bg-veloce-50",
    },
    {
      label: "Mensajes",
      value: interactionCount.toString(),
      sub: metrics.lastInboundAt
        ? `Ultimo del cliente ${formatRelativeTime(metrics.lastInboundAt)}`
        : "Sin mensajes entrantes",
      icon: MessageCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Bicicletas",
      value: bikesCount.toString(),
      sub: bikesCount > 0 ? "Registradas" : "Sin registrar",
      icon: Bike,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Resumen</h3>
        {metrics.lastInteractionAt && (
          <span className="text-[10px] text-gray-400 inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Actividad {formatRelativeTime(metrics.lastInteractionAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <div
              key={it.label}
              className="rounded-lg border border-gray-100 p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center",
                    it.bg
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", it.color)} />
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {it.label}
                </span>
              </div>
              <p className="text-base font-bold text-gray-900 mt-1.5 leading-tight">
                {it.value}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{it.sub}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

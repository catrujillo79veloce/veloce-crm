"use client"

import Link from "next/link"
import { Badge, Avatar } from "@/components/ui"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DEAL_STAGES } from "@/lib/constants"
import type { Deal } from "@/lib/types"

interface ContactDealsProps {
  deals: Deal[]
}

export function ContactDeals({ deals }: ContactDealsProps) {
  const { locale } = useI18n()

  if (deals.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No hay ventas asociadas
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deals.map((deal) => {
        const stageConfig = DEAL_STAGES.find((s) => s.value === deal.stage)
        return (
          <Link
            key={deal.id}
            href={`/deals/${deal.id}`}
            className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-veloce-200 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {deal.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {stageConfig && (
                    <Badge color={stageConfig.color}>
                      {stageConfig.label[locale] ?? stageConfig.label.es}
                    </Badge>
                  )}
                  {deal.expected_close_date && (
                    <span className="text-xs text-gray-500">
                      Cierre: {formatDate(deal.expected_close_date, locale)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(deal.amount, deal.currency)}
                </p>
                <p className="text-xs text-gray-500">
                  {deal.probability}% prob.
                </p>
              </div>
            </div>
            {deal.assigned_member && (
              <div className="mt-2 flex items-center gap-2">
                <Avatar
                  src={deal.assigned_member.avatar_url}
                  firstName={deal.assigned_member.full_name.split(" ")[0]}
                  lastName={deal.assigned_member.full_name.split(" ")[1]}
                  size="sm"
                />
                <span className="text-xs text-gray-500">
                  {deal.assigned_member.full_name}
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

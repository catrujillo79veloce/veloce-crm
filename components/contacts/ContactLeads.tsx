"use client"

import Link from "next/link"
import { Badge, Avatar } from "@/components/ui"
import { useI18n } from "@/lib/i18n/config"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import { LEAD_STATUSES, PRIORITIES } from "@/lib/constants"
import type { Lead } from "@/lib/types"

interface ContactLeadsProps {
  leads: Lead[]
}

export function ContactLeads({ leads }: ContactLeadsProps) {
  const { locale } = useI18n()

  if (leads.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No hay leads asociados
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => {
        const statusConfig = LEAD_STATUSES.find(
          (s) => s.value === lead.status
        )
        const priorityConfig = PRIORITIES.find(
          (p) => p.value === lead.priority
        )

        return (
          <Link
            key={lead.id}
            href={`/leads?highlight=${lead.id}`}
            className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-veloce-200 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {lead.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {statusConfig && (
                    <Badge color={statusConfig.color}>
                      {statusConfig.label[locale] ?? statusConfig.label.es}
                    </Badge>
                  )}
                  {priorityConfig && (
                    <Badge color={priorityConfig.color} variant="outline">
                      {priorityConfig.label[locale] ?? priorityConfig.label.es}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {lead.estimated_value != null && (
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(lead.estimated_value)}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {formatRelativeTime(lead.created_at, locale)}
                </p>
              </div>
            </div>
            {lead.assigned_member && (
              <div className="mt-2 flex items-center gap-2">
                <Avatar
                  src={lead.assigned_member.avatar_url}
                  firstName={lead.assigned_member.full_name.split(" ")[0]}
                  lastName={lead.assigned_member.full_name.split(" ")[1]}
                  size="sm"
                />
                <span className="text-xs text-gray-500">
                  {lead.assigned_member.full_name}
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

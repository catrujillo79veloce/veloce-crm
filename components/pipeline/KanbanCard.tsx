"use client"

import React from "react"
import { GripVertical, Clock } from "lucide-react"
import { cn, formatCurrency, getScoreColor } from "@/lib/utils"
import { Avatar, Badge } from "@/components/ui"
import { PRIORITIES } from "@/lib/constants"
import type { Lead } from "@/lib/types"

export interface KanbanCardProps {
  lead: Lead
  locale?: "es" | "en"
  onClick?: () => void
}

function KanbanCard({ lead, locale = "es", onClick }: KanbanCardProps) {
  const contactName = lead.contact
    ? `${lead.contact.first_name} ${lead.contact.last_name}`
    : "Sin contacto"

  const priorityConfig = PRIORITIES.find((p) => p.value === lead.priority)
  const priorityLabel = priorityConfig?.label[locale] || lead.priority
  const priorityColor = priorityConfig?.color || "#6b7280"

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / 86400000
  )

  const scoreColor = getScoreColor(lead.score)

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-gray-200 bg-white p-3 shadow-sm",
        "cursor-grab transition-shadow",
        "hover:shadow-md hover:border-gray-300",
        "active:cursor-grabbing active:shadow-lg"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${lead.title} - ${contactName}`}
    >
      {/* Drag handle indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-gray-300" />
      </div>

      {/* Contact row */}
      <div className="flex items-center gap-2 mb-2">
        <Avatar
          src={lead.contact?.avatar_url}
          firstName={lead.contact?.first_name || "?"}
          lastName={lead.contact?.last_name || ""}
          size="sm"
        />
        <span className="text-xs text-gray-500 truncate flex-1">
          {contactName}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 pr-4">
        {lead.title}
      </p>

      {/* Value */}
      {lead.estimated_value !== null && lead.estimated_value > 0 && (
        <p className="text-sm font-semibold text-gray-800 mb-2">
          {formatCurrency(lead.estimated_value)}
        </p>
      )}

      {/* Bottom row: priority + score + assigned + days */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Priority badge */}
        <Badge color={priorityColor} className="text-[10px] px-1.5 py-0">
          {priorityLabel}
        </Badge>

        {/* Score circle */}
        {lead.score > 0 && (
          <span
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
              scoreColor
            )}
            title={`Score: ${lead.score}`}
          >
            {lead.score}
          </span>
        )}

        <div className="flex-1" />

        {/* Assigned to avatar */}
        {lead.assigned_member && (
          <Avatar
            src={lead.assigned_member.avatar_url}
            firstName={lead.assigned_member.full_name?.split(" ")[0] || ""}
            lastName={lead.assigned_member.full_name?.split(" ")[1] || ""}
            size="sm"
            className="h-5 w-5 text-[8px]"
            title={lead.assigned_member.full_name}
          />
        )}

        {/* Days since created */}
        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400" title={`${daysSinceCreated}d`}>
          <Clock className="h-3 w-3" />
          {daysSinceCreated}d
        </span>
      </div>
    </div>
  )
}

export { KanbanCard }

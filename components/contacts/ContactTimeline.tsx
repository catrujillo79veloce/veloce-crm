"use client"

import React, { useState, useTransition } from "react"
import {
  Phone,
  MessageCircle,
  MessageSquare,
  Camera,
  Mail,
  Store,
  Globe,
  StickyNote,
  Users as MeetingIcon,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui"
import { useI18n } from "@/lib/i18n/config"
import { formatRelativeTime, cn } from "@/lib/utils"
import { getContactInteractions } from "@/app/actions/contacts"
import type { Interaction, InteractionType } from "@/lib/types"

// -------------------------------------------------------------------
// Type icon / color map
// -------------------------------------------------------------------

const INTERACTION_CONFIG: Record<
  InteractionType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-100" },
  whatsapp_message: {
    icon: MessageCircle,
    color: "text-green-600",
    bg: "bg-green-100",
  },
  facebook_message: {
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  instagram_message: {
    icon: Camera,
    color: "text-pink-600",
    bg: "bg-pink-100",
  },
  email: { icon: Mail, color: "text-orange-600", bg: "bg-orange-100" },
  visit_store: { icon: Store, color: "text-purple-600", bg: "bg-purple-100" },
  website_form: { icon: Globe, color: "text-gray-600", bg: "bg-gray-100" },
  note: { icon: StickyNote, color: "text-yellow-600", bg: "bg-yellow-100" },
  meeting: {
    icon: MeetingIcon,
    color: "text-veloce-600",
    bg: "bg-veloce-50",
  },
}

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface ContactTimelineProps {
  contactId: string
  initialInteractions: Interaction[]
  totalCount: number
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function ContactTimeline({
  contactId,
  initialInteractions,
  totalCount,
}: ContactTimelineProps) {
  const { locale } = useI18n()
  const [interactions, setInteractions] = useState(initialInteractions)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const hasMore = interactions.length < totalCount

  function loadMore() {
    const nextPage = page + 1
    startTransition(async () => {
      const result = await getContactInteractions(contactId, nextPage)
      setInteractions((prev) => [...prev, ...result.data])
      setPage(nextPage)
    })
  }

  if (interactions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No hay interacciones registradas
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />

        <div className="space-y-4">
          {interactions.map((item) => {
            const config =
              INTERACTION_CONFIG[item.type] ?? INTERACTION_CONFIG.note
            const Icon = config.icon

            return (
              <div key={item.id} className="relative flex gap-4 pl-0">
                {/* Dot */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    config.bg
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.subject || item.type.replace(/_/g, " ")}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatRelativeTime(item.occurred_at, locale)}
                    </span>
                  </div>
                  {item.body && (
                    <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">
                      {item.body}
                    </p>
                  )}
                  {item.team_member && (
                    <p className="mt-1 text-xs text-gray-400">
                      {item.team_member.full_name}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            loading={isPending}
          >
            <ChevronDown className="h-4 w-4" />
            Cargar mas
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Activity,
  Phone,
  MessageCircle,
  MessageSquare,
  Camera,
  Mail,
  Store,
  Globe,
  StickyNote,
  Users,
  ArrowRight,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"
import type { RecentActivityItem } from "@/app/actions/analytics"

type ChannelFilter = "all" | "whatsapp_message" | "instagram_message" | "facebook_message" | "other"

const interactionIcons: Record<string, { icon: typeof Phone; color: string; bg: string }> = {
  call: { icon: Phone, color: "text-yellow-600", bg: "bg-yellow-50" },
  whatsapp_message: { icon: MessageCircle, color: "text-green-600", bg: "bg-green-50" },
  facebook_message: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
  instagram_message: { icon: Camera, color: "text-pink-600", bg: "bg-pink-50" },
  email: { icon: Mail, color: "text-gray-600", bg: "bg-gray-50" },
  visit_store: { icon: Store, color: "text-purple-600", bg: "bg-purple-50" },
  website_form: { icon: Globe, color: "text-gray-600", bg: "bg-gray-50" },
  note: { icon: StickyNote, color: "text-amber-600", bg: "bg-amber-50" },
  meeting: { icon: Users, color: "text-veloce-600", bg: "bg-veloce-50" },
}

const interactionLabels: Record<string, { es: string; en: string }> = {
  call: { es: "Llamada", en: "Call" },
  whatsapp_message: { es: "WhatsApp", en: "WhatsApp" },
  facebook_message: { es: "Facebook", en: "Facebook" },
  instagram_message: { es: "Instagram", en: "Instagram" },
  email: { es: "Correo", en: "Email" },
  visit_store: { es: "Visita", en: "Visit" },
  website_form: { es: "Formulario web", en: "Web form" },
  note: { es: "Nota", en: "Note" },
  meeting: { es: "Reunion", en: "Meeting" },
}

interface RecentActivityProps {
  activities: RecentActivityItem[]
}

const CHANNEL_FILTERS: Array<{
  value: ChannelFilter
  label: string
  icon: typeof MessageCircle | null
  color: string
}> = [
  { value: "all", label: "Todo", icon: null, color: "text-gray-600" },
  { value: "whatsapp_message", label: "WhatsApp", icon: MessageCircle, color: "text-green-600" },
  { value: "instagram_message", label: "Instagram", icon: Camera, color: "text-pink-600" },
  { value: "facebook_message", label: "Facebook", icon: MessageSquare, color: "text-blue-600" },
]

export default function RecentActivity({ activities }: RecentActivityProps) {
  const { t, locale } = useI18n()
  const [filter, setFilter] = useState<ChannelFilter>("all")

  const filtered = useMemo(() => {
    if (filter === "all") return activities
    return activities.filter((a) => a.type === filter)
  }, [activities, filter])

  // Count per channel for badges
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of activities) {
      c[a.type] = (c[a.type] ?? 0) + 1
    }
    return c
  }, [activities])

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {t.dashboard.recentActivity}
          </h2>
        </div>
        <p className="text-sm text-gray-400 text-center py-6">
          {locale === "es" ? "Sin actividad reciente" : "No recent activity"}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {t.dashboard.recentActivity}
          </h2>
        </div>
        <Link
          href="/contacts"
          className="text-xs text-veloce-600 hover:text-veloce-700 font-medium flex items-center gap-1"
        >
          {locale === "es" ? "Ver todo" : "View all"}
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Channel filters */}
      <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-gray-100">
        {CHANNEL_FILTERS.map((f) => {
          const active = filter === f.value
          const count =
            f.value === "all"
              ? activities.length
              : counts[f.value] ?? 0
          const Icon = f.icon
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1",
                active
                  ? "bg-veloce-50 border-veloce-300 text-veloce-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              )}
            >
              {Icon && <Icon size={11} className={active ? "" : f.color} />}
              {f.label}
              <span className="text-gray-400">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          {locale === "es" ? "Sin actividad en este canal" : "No activity in this channel"}
        </p>
      ) : (
      <div className="space-y-1">
        {filtered.map((activity) => {
          const config = interactionIcons[activity.type] || interactionIcons.note
          const Icon = config.icon
          const label = interactionLabels[activity.type]
          const directionLabel =
            activity.direction === "inbound"
              ? locale === "es"
                ? "entrante"
                : "inbound"
              : activity.direction === "outbound"
                ? locale === "es"
                  ? "saliente"
                  : "outbound"
                : ""

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0"
            >
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  config.bg
                )}
              >
                <Icon size={14} className={config.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <Link
                    href={`/contacts/${activity.contact_id}`}
                    className="font-medium hover:text-veloce-600"
                  >
                    {activity.contact_name}
                  </Link>
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {label?.[locale] || activity.type}
                  {directionLabel ? ` ${directionLabel}` : ""}
                  {activity.subject ? ` - ${activity.subject}` : ""}
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                {formatRelativeTime(activity.occurred_at, locale)}
              </span>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

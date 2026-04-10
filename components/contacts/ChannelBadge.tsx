"use client"

import {
  Globe,
  MessageSquare,
  Camera,
  MessageCircle,
  Store,
  Users,
  PenLine,
  Bike,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTACT_SOURCES } from "@/lib/constants"
import { useI18n } from "@/lib/i18n/config"
import type { ContactSource } from "@/lib/types"

const iconMap: Record<string, React.ElementType> = {
  Globe,
  Facebook: MessageSquare,
  Instagram: Camera,
  MessageCircle,
  Store,
  Users,
  PenLine,
  Bike,
}

interface ChannelBadgeProps {
  source: ContactSource
  className?: string
}

export function ChannelBadge({ source, className }: ChannelBadgeProps) {
  const { locale } = useI18n()

  const config = CONTACT_SOURCES.find((s) => s.value === source)
  if (!config) return null

  const Icon = iconMap[config.icon] ?? Globe
  const label = config.label[locale] ?? config.label.es

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: `${config.color}18`,
        color: config.color,
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

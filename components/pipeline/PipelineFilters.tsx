"use client"

import React from "react"
import { Search } from "lucide-react"
import { useI18n } from "@/lib/i18n/config"
import { PRIORITIES } from "@/lib/constants"
import { Input, Select } from "@/components/ui"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface PipelineFiltersProps {
  teamMembers: TeamMemberOption[]
  assignedTo: string
  onAssignedToChange: (value: string) => void
  priority: string
  onPriorityChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
}

export function PipelineFilters({
  teamMembers,
  assignedTo,
  onAssignedToChange,
  priority,
  onPriorityChange,
  search,
  onSearchChange,
}: PipelineFiltersProps) {
  const { t, locale } = useI18n()

  const memberOptions = [
    { value: "", label: locale === "es" ? "Todos" : "All" },
    ...teamMembers.map((m) => ({ value: m.id, label: m.full_name })),
  ]

  const priorityOptions = [
    { value: "", label: locale === "es" ? "Todas" : "All" },
    ...PRIORITIES.map((p) => ({ value: p.value, label: p.label[locale] })),
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
      <div className="w-48 min-w-[140px]">
        <Input
          placeholder={locale === "es" ? "Buscar leads..." : "Search leads..."}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      <div className="w-40 min-w-[120px]">
        <Select
          options={memberOptions}
          value={assignedTo}
          onChange={(e) => onAssignedToChange(e.target.value)}
          placeholder={locale === "es" ? "Asignado a" : "Assigned to"}
        />
      </div>

      <div className="w-36 min-w-[110px]">
        <Select
          options={priorityOptions}
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
          placeholder={t.leads.priority}
        />
      </div>
    </div>
  )
}

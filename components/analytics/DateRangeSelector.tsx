"use client"

import { useState } from "react"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"

export interface DateRange {
  from: string
  to: string
}

interface DateRangeSelectorProps {
  value?: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

type PresetKey = "today" | "thisWeek" | "thisMonth" | "thisQuarter" | "custom"

function getPresetRange(key: PresetKey): DateRange | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (key) {
    case "today":
      return {
        from: today.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      }
    case "thisWeek": {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      return {
        from: startOfWeek.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      }
    }
    case "thisMonth": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        from: startOfMonth.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      }
    }
    case "thisQuarter": {
      const quarter = Math.floor(now.getMonth() / 3)
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1)
      return {
        from: startOfQuarter.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      }
    }
    default:
      return null
  }
}

export default function DateRangeSelector({
  value,
  onChange,
  className,
}: DateRangeSelectorProps) {
  const { locale } = useI18n()
  const [activePreset, setActivePreset] = useState<PresetKey>("thisMonth")
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(value?.from || "")
  const [customTo, setCustomTo] = useState(value?.to || "")

  const presets: { key: PresetKey; label: { es: string; en: string } }[] = [
    { key: "today", label: { es: "Hoy", en: "Today" } },
    { key: "thisWeek", label: { es: "Esta Semana", en: "This Week" } },
    { key: "thisMonth", label: { es: "Este Mes", en: "This Month" } },
    { key: "thisQuarter", label: { es: "Este Trimestre", en: "This Quarter" } },
    { key: "custom", label: { es: "Personalizado", en: "Custom" } },
  ]

  const handlePresetClick = (key: PresetKey) => {
    setActivePreset(key)
    if (key === "custom") {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    const range = getPresetRange(key)
    if (range) {
      onChange(range)
    }
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo })
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Calendar size={16} className="text-gray-400" />
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => handlePresetClick(preset.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              activePreset === preset.key
                ? "bg-veloce-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {preset.label[locale]}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
          />
          <span className="text-xs text-gray-400">-</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-veloce-500"
          />
          <button
            onClick={handleCustomApply}
            className="px-3 py-1.5 text-xs font-medium bg-veloce-500 text-white rounded-lg hover:bg-veloce-600 transition-colors"
          >
            {locale === "es" ? "Aplicar" : "Apply"}
          </button>
        </div>
      )}
    </div>
  )
}

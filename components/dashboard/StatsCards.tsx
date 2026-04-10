"use client"

import {
  Target,
  DollarSign,
  TrendingUp,
  CheckSquare,
  type LucideIcon,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"

export interface StatsCardsData {
  newLeadsThisWeek: number
  closedDealsThisMonth: number
  pipelineValue: number
  pendingTasks: number
  newLeadsChange: number
  closedDealsChange: number
  pipelineValueChange: number
  pendingTasksChange: number
}

interface StatCardConfig {
  icon: LucideIcon
  labelKey: "newLeads" | "closedDeals" | "pipelineValue" | "pendingTasks"
  valueKey: keyof StatsCardsData
  changeKey: keyof StatsCardsData
  format?: "currency" | "number"
  changeLabelEs: string
  changeLabelEn: string
}

const statConfigs: StatCardConfig[] = [
  {
    icon: Target,
    labelKey: "newLeads",
    valueKey: "newLeadsThisWeek",
    changeKey: "newLeadsChange",
    format: "number",
    changeLabelEs: "vs semana anterior",
    changeLabelEn: "vs last week",
  },
  {
    icon: DollarSign,
    labelKey: "closedDeals",
    valueKey: "closedDealsThisMonth",
    changeKey: "closedDealsChange",
    format: "number",
    changeLabelEs: "vs mes anterior",
    changeLabelEn: "vs last month",
  },
  {
    icon: TrendingUp,
    labelKey: "pipelineValue",
    valueKey: "pipelineValue",
    changeKey: "pipelineValueChange",
    format: "currency",
    changeLabelEs: "vs mes anterior",
    changeLabelEn: "vs last month",
  },
  {
    icon: CheckSquare,
    labelKey: "pendingTasks",
    valueKey: "pendingTasks",
    changeKey: "pendingTasksChange",
    format: "number",
    changeLabelEs: "vs semana anterior",
    changeLabelEn: "vs last week",
  },
]

interface StatsCardsProps {
  data?: StatsCardsData | null
}

export default function StatsCards({ data }: StatsCardsProps) {
  const { t, locale } = useI18n()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {statConfigs.map((config) => {
        const Icon = config.icon
        const value = data ? Number(data[config.valueKey]) : 0
        const change = data ? Number(data[config.changeKey]) : 0
        const isPositive = change >= 0
        const isGood =
          config.labelKey === "pendingTasks" ? !isPositive : isPositive

        const displayValue =
          config.format === "currency"
            ? formatCurrency(value)
            : String(value)

        const changeLabel =
          locale === "es" ? config.changeLabelEs : config.changeLabelEn

        return (
          <div
            key={config.labelKey}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-500 truncate">
                  {t.dashboard[config.labelKey]}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {data ? displayValue : (
                    <span className="inline-block h-7 w-20 bg-gray-100 rounded animate-pulse" />
                  )}
                </p>
              </div>
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-veloce-50">
                <Icon size={20} className="text-veloce-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {data ? (
                <>
                  <span
                    className={cn(
                      "inline-flex items-center text-xs font-semibold",
                      isGood ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {change}%
                  </span>
                  <span className="text-xs text-gray-400">{changeLabel}</span>
                </>
              ) : (
                <span className="inline-block h-3 w-24 bg-gray-50 rounded animate-pulse" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

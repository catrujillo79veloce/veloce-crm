"use client"

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { useI18n } from "@/lib/i18n/config"
import type { ChannelPerformanceItem } from "@/app/actions/analytics"

interface ChannelBreakdownProps {
  data: ChannelPerformanceItem[]
  height?: number
}

export default function ChannelBreakdown({
  data,
  height = 280,
}: ChannelBreakdownProps) {
  const { locale } = useI18n()

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        {locale === "es" ? "Sin datos de canales" : "No channel data"}
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: item.label,
    value: item.count,
    converted: item.converted,
    color: item.color,
  }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          <p className="text-sm font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">
            {locale === "es" ? "Contactos" : "Contacts"}: {item.value} ({percentage}%)
          </p>
          <p className="text-sm text-veloce-600">
            {locale === "es" ? "Convertidos" : "Converted"}: {item.converted}
          </p>
        </div>
      )
    }
    return null
  }

  const renderLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-600">
              {entry.value}{" "}
              <span className="text-gray-400">
                ({chartData[index]?.value || 0})
              </span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={renderLegend} />
      </PieChart>
    </ResponsiveContainer>
  )
}

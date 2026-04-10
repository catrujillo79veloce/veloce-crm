"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { useI18n } from "@/lib/i18n/config"
import type { LeadFunnelItem } from "@/app/actions/analytics"

interface LeadFunnelChartProps {
  data: LeadFunnelItem[]
  height?: number
}

export default function LeadFunnelChart({
  data,
  height = 250,
}: LeadFunnelChartProps) {
  const { locale } = useI18n()

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        {locale === "es" ? "Sin datos de leads" : "No lead data"}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" tick={{ fontSize: 12, fill: "#9ca3af" }} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: number) => [value, "Leads"]) as any}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

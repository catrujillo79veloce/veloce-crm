"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts"
import { ArrowLeft, Globe, Users, TrendingUp, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"
import DateRangeSelector, {
  type DateRange,
} from "@/components/analytics/DateRangeSelector"
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown"
import {
  getChannelPerformanceData,
  type ChannelPerformanceItem,
} from "@/app/actions/analytics"

export default function ChannelsAnalyticsPage() {
  const { locale } = useI18n()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })
  const [channelData, setChannelData] = useState<ChannelPerformanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const channels = await getChannelPerformanceData()
        setChannelData(channels)
      } catch (error) {
        console.error("Error loading channel analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [dateRange])

  const totalContacts = channelData.reduce((sum, ch) => sum + ch.count, 0)
  const totalConverted = channelData.reduce((sum, ch) => sum + ch.converted, 0)
  const overallConvRate =
    totalContacts > 0 ? Math.round((totalConverted / totalContacts) * 100) : 0

  const conversionRateData = channelData.map((ch) => ({
    name: ch.label,
    rate: ch.count > 0 ? Math.round((ch.converted / ch.count) * 100) : 0,
    color: ch.color,
  }))

  const Spinner = () => (
    <div className="h-[300px] flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {locale === "es"
                ? "Rendimiento por Canal"
                : "Channel Performance"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {locale === "es"
                ? "Analisis de captacion y conversion por canal"
                : "Acquisition and conversion analysis by channel"}
            </p>
          </div>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Canales Activos" : "Active Channels"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {channelData.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-veloce-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Total Contactos" : "Total Contacts"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalContacts}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-amber-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Convertidos" : "Converted"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalConverted}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-purple-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Tasa General" : "Overall Rate"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">{overallConvRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads per Channel (bar chart) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Contactos por Canal"
              : "Contacts per Channel"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={channelData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number, name: string) => [
                    value,
                    name === "count"
                      ? locale === "es"
                        ? "Contactos"
                        : "Contacts"
                      : locale === "es"
                        ? "Convertidos"
                        : "Converted",
                  ]) as any}
                />
                <Legend
                  formatter={(value) =>
                    value === "count"
                      ? locale === "es"
                        ? "Contactos"
                        : "Contacts"
                      : locale === "es"
                        ? "Convertidos"
                        : "Converted"
                  }
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Bar
                  dataKey="converted"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribution pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Distribucion por Canal"
              : "Channel Distribution"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ChannelBreakdown data={channelData} height={350} />
          )}
        </div>

        {/* Conversion Rate per Channel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Tasa de Conversion por Canal"
              : "Conversion Rate per Channel"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={conversionRateData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
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
                  formatter={((value: number) => [
                    `${value}%`,
                    locale === "es" ? "Conversion" : "Conversion",
                  ]) as any}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={20}>
                  {conversionRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Channel Comparison Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Tabla Comparativa"
              : "Comparison Table"}
          </h2>
          {loading ? (
            <Spinner />
          ) : channelData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
              {locale === "es"
                ? "Sin datos de canales"
                : "No channel data"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Canal" : "Channel"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Contactos" : "Contacts"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Convertidos" : "Converted"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Tasa" : "Rate"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "% del Total" : "% of Total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {channelData.map((channel) => {
                    const convRate =
                      channel.count > 0
                        ? Math.round(
                            (channel.converted / channel.count) * 100
                          )
                        : 0
                    const shareOfTotal =
                      totalContacts > 0
                        ? Math.round((channel.count / totalContacts) * 100)
                        : 0

                    return (
                      <tr
                        key={channel.source}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: channel.color }}
                            />
                            <span className="text-gray-900 font-medium">
                              {channel.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-700">
                          {channel.count}
                        </td>
                        <td className="py-3 px-2 text-right text-veloce-600 font-medium">
                          {channel.converted}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                              convRate >= 30
                                ? "bg-green-50 text-green-700"
                                : convRate >= 15
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-50 text-gray-600"
                            )}
                          >
                            {convRate}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${shareOfTotal}%`,
                                  backgroundColor: channel.color,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">
                              {shareOfTotal}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

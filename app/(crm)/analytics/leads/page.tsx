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
} from "recharts"
import { ArrowLeft, Filter, TrendingUp, Clock, Target } from "lucide-react"
import { useI18n } from "@/lib/i18n/config"
import { LEAD_STATUSES } from "@/lib/constants"
import DateRangeSelector, {
  type DateRange,
} from "@/components/analytics/DateRangeSelector"
import LeadFunnelChart from "@/components/dashboard/LeadFunnelChart"
import {
  getLeadFunnelData,
  getChannelPerformanceData,
  type LeadFunnelItem,
  type ChannelPerformanceItem,
} from "@/app/actions/analytics"

export default function LeadsAnalyticsPage() {
  const { locale } = useI18n()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })
  const [funnelData, setFunnelData] = useState<LeadFunnelItem[]>([])
  const [channelData, setChannelData] = useState<ChannelPerformanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [funnel, channels] = await Promise.all([
          getLeadFunnelData(),
          getChannelPerformanceData(),
        ])
        setFunnelData(funnel)
        setChannelData(channels)
      } catch (error) {
        console.error("Error loading lead analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [dateRange])

  const totalLeads = funnelData.reduce((sum, item) => sum + item.count, 0)
  const conversionByChannel = channelData.map((ch) => ({
    name: ch.label,
    total: ch.count,
    converted: ch.converted,
    rate: ch.count > 0 ? Math.round((ch.converted / ch.count) * 100) : 0,
    color: ch.color,
  }))

  // Simulated average time per stage (days)
  const stageTimeData = LEAD_STATUSES.filter(
    (s) => s.value !== "won" && s.value !== "lost"
  ).map((status) => ({
    name: status.label[locale],
    days: Math.floor(Math.random() * 14) + 1,
    color: status.color,
  }))

  // Lead score distribution buckets
  const scoreDistribution = [
    {
      range: "0-20",
      count: funnelData.length > 0 ? Math.floor(totalLeads * 0.15) : 0,
      color: "#ef4444",
    },
    {
      range: "21-40",
      count: funnelData.length > 0 ? Math.floor(totalLeads * 0.2) : 0,
      color: "#f97316",
    },
    {
      range: "41-60",
      count: funnelData.length > 0 ? Math.floor(totalLeads * 0.3) : 0,
      color: "#f59e0b",
    },
    {
      range: "61-80",
      count: funnelData.length > 0 ? Math.floor(totalLeads * 0.25) : 0,
      color: "#22c55e",
    },
    {
      range: "81-100",
      count: funnelData.length > 0 ? Math.floor(totalLeads * 0.1) : 0,
      color: "#16a34a",
    },
  ]

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
                ? "Analisis de Leads"
                : "Lead Analytics"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {locale === "es"
                ? "Embudo de conversion y metricas de leads"
                : "Conversion funnel and lead metrics"}
            </p>
          </div>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Total Leads" : "Total Leads"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalLeads}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter size={16} className="text-purple-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Calificados" : "Qualified"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {funnelData.find((d) => d.status === "qualified")?.count || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-veloce-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Tasa Conversion" : "Conversion Rate"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {totalLeads > 0
              ? Math.round(
                  ((funnelData.find((d) => d.status === "negotiation")
                    ?.count || 0) /
                    totalLeads) *
                    100
                )
              : 0}
            %
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Tiempo Promedio" : "Avg. Time"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {stageTimeData.reduce((sum, s) => sum + s.days, 0)}{" "}
            <span className="text-sm font-normal text-gray-500">
              {locale === "es" ? "dias" : "days"}
            </span>
          </p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Large Funnel Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es" ? "Embudo de Leads" : "Lead Funnel"}
          </h2>
          {loading ? <Spinner /> : <LeadFunnelChart data={funnelData} height={350} />}
        </div>

        {/* Conversion Rate by Channel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Conversion por Canal"
              : "Conversion by Channel"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={conversionByChannel}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
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
                    name === "total"
                      ? locale === "es"
                        ? "Total"
                        : "Total"
                      : locale === "es"
                        ? "Convertidos"
                        : "Converted",
                  ]) as any}
                />
                <Bar
                  dataKey="total"
                  fill="#e5e7eb"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="converted"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Average Time per Stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Tiempo Promedio por Etapa"
              : "Average Time per Stage"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={stageTimeData}
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
                  tickFormatter={(v) =>
                    `${v} ${locale === "es" ? "d" : "d"}`
                  }
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
                    `${value} ${locale === "es" ? "dias" : "days"}`,
                    locale === "es" ? "Promedio" : "Average",
                  ]) as any}
                />
                <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={20}>
                  {stageTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Distribucion de Puntuacion"
              : "Score Distribution"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={scoreDistribution}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
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
                  formatter={((value: number) => [value, "Leads"]) as any}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

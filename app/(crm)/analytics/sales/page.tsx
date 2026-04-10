"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  LineChart,
  Line,
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
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Target,
  Trophy,
} from "lucide-react"
import { cn, formatCurrency, getInitials } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"
import DateRangeSelector, {
  type DateRange,
} from "@/components/analytics/DateRangeSelector"
import {
  getSalesPerformanceData,
  getTeamLeaderboardData,
  getRevenueData,
  type SalesPerformanceData,
  type TeamLeaderboardItem,
  type RevenueDataPoint,
} from "@/app/actions/analytics"

export default function SalesAnalyticsPage() {
  const { locale } = useI18n()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })
  const [salesData, setSalesData] = useState<SalesPerformanceData | null>(null)
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardItem[]>([])
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [sales, leaders, revenue] = await Promise.all([
          getSalesPerformanceData(),
          getTeamLeaderboardData(),
          getRevenueData(6),
        ])
        setSalesData(sales)
        setLeaderboard(leaders)
        setRevenueData(revenue)
      } catch (error) {
        console.error("Error loading sales analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [dateRange])

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
                ? "Analisis de Ventas"
                : "Sales Analytics"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {locale === "es"
                ? "Rendimiento de ventas y metricas del equipo"
                : "Sales performance and team metrics"}
            </p>
          </div>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-veloce-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Ingresos Totales" : "Total Revenue"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {salesData ? formatCurrency(salesData.totalRevenue) : "-"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Venta Promedio" : "Avg. Deal Size"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {salesData ? formatCurrency(salesData.avgDealSize) : "-"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-amber-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Tasa de Cierre" : "Win Rate"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {salesData ? `${salesData.winRate}%` : "-"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} className="text-purple-500" />
            <span className="text-xs text-gray-500">
              {locale === "es" ? "Total Ventas" : "Total Deals"}
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {salesData ? salesData.totalDeals : "-"}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time (Line Chart) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Ingresos por Mes"
              : "Revenue Over Time"}
          </h2>
          {loading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={revenueData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number) => [formatCurrency(value), locale === "es" ? "Ingresos" : "Revenue"]) as any}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deals by Stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Ventas por Etapa"
              : "Deals by Stage"}
          </h2>
          {loading || !salesData ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={salesData.dealsByStage}
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
                  formatter={((value: number) => [value, locale === "es" ? "Ventas" : "Deals"]) as any}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {salesData.dealsByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Won vs Lost by Month */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Ganadas vs Perdidas por Mes"
              : "Won vs Lost by Month"}
          </h2>
          {loading || !salesData ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={salesData.dealsByMonth}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
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
                />
                <Legend
                  formatter={(value) =>
                    value === "won"
                      ? locale === "es"
                        ? "Ganadas"
                        : "Won"
                      : locale === "es"
                        ? "Perdidas"
                        : "Lost"
                  }
                />
                <Bar
                  dataKey="won"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="lost"
                  fill="#6b7280"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Team Leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {locale === "es"
              ? "Leaderboard del Equipo"
              : "Team Leaderboard"}
          </h2>
          {loading ? (
            <Spinner />
          ) : leaderboard.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
              {locale === "es"
                ? "Sin datos del equipo"
                : "No team data"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-500">
                      #
                    </th>
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Miembro" : "Member"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Cerradas" : "Closed"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      {locale === "es" ? "Ingresos" : "Revenue"}
                    </th>
                    <th className="text-right py-2.5 px-2 text-xs font-medium text-gray-500">
                      Leads
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((member, index) => {
                    const nameParts = member.name.split(" ")
                    const initials = getInitials(nameParts[0], nameParts[1])
                    return (
                      <tr
                        key={member.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 px-2">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                              index === 0
                                ? "bg-yellow-100 text-yellow-700"
                                : index === 1
                                  ? "bg-gray-100 text-gray-600"
                                  : index === 2
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-50 text-gray-400"
                            )}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-veloce-100 flex items-center justify-center text-xs font-medium text-veloce-700">
                              {initials}
                            </div>
                            <span className="text-gray-900 font-medium truncate">
                              {member.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-gray-900">
                          {member.closed_deals}
                        </td>
                        <td className="py-3 px-2 text-right text-veloce-600 font-medium">
                          {formatCurrency(member.total_revenue)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500">
                          {member.leads_handled}
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

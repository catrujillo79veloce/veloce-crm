"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  TrendingUp,
  Users,
  Filter,
  ArrowRight,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/config"
import DateRangeSelector, {
  type DateRange,
} from "@/components/analytics/DateRangeSelector"
import LeadFunnelChart from "@/components/dashboard/LeadFunnelChart"
import RevenuePipelineChart from "@/components/dashboard/RevenuePipelineChart"
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown"
import {
  getLeadFunnelData,
  getRevenueData,
  getChannelPerformanceData,
  type LeadFunnelItem,
  type RevenueDataPoint,
  type ChannelPerformanceItem,
} from "@/app/actions/analytics"

const navCards = [
  {
    href: "/analytics/leads",
    icon: Filter,
    titleEs: "Leads",
    titleEn: "Leads",
    descEs: "Embudo de conversion, tasas por canal y tiempo en etapas",
    descEn: "Conversion funnel, rates by channel and stage time",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/analytics/sales",
    icon: TrendingUp,
    titleEs: "Ventas",
    titleEn: "Sales",
    descEs: "Ingresos, tamano de ventas, tasa de cierre y leaderboard",
    descEn: "Revenue, deal size, win rate and leaderboard",
    color: "bg-veloce-50 text-veloce-600",
  },
  {
    href: "/analytics/channels",
    icon: Users,
    titleEs: "Canales",
    titleEn: "Channels",
    descEs: "Rendimiento por canal, conversion y comparacion",
    descEn: "Channel performance, conversion and comparison",
    color: "bg-purple-50 text-purple-600",
  },
]

export default function AnalyticsPage() {
  const { t, locale } = useI18n()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })
  const [funnelData, setFunnelData] = useState<LeadFunnelItem[]>([])
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [channelData, setChannelData] = useState<ChannelPerformanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [funnel, revenue, channels] = await Promise.all([
          getLeadFunnelData(),
          getRevenueData(6),
          getChannelPerformanceData(),
        ])
        setFunnelData(funnel)
        setRevenueData(revenue)
        setChannelData(channels)
      } catch (error) {
        console.error("Error loading analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [dateRange])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t.analytics.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "es"
              ? "Vision general del rendimiento"
              : "Performance overview"}
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {navCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-veloce-200 transition-all"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}
                >
                  <Icon size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-gray-300 group-hover:text-veloce-500 transition-colors"
                />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                {locale === "es" ? card.titleEs : card.titleEn}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {locale === "es" ? card.descEs : card.descEn}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t.analytics.leadConversion}
            </h2>
            <Link
              href="/analytics/leads"
              className="text-xs text-veloce-600 hover:text-veloce-700 font-medium flex items-center gap-1"
            >
              {locale === "es" ? "Ver detalle" : "View details"}
              <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <LeadFunnelChart data={funnelData} height={300} />
          )}
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t.analytics.salesPerformance}
            </h2>
            <Link
              href="/analytics/sales"
              className="text-xs text-veloce-600 hover:text-veloce-700 font-medium flex items-center gap-1"
            >
              {locale === "es" ? "Ver detalle" : "View details"}
              <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <RevenuePipelineChart data={revenueData} height={300} />
          )}
        </div>

        {/* Channel Performance */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t.analytics.channelPerformance}
            </h2>
            <Link
              href="/analytics/channels"
              className="text-xs text-veloce-600 hover:text-veloce-700 font-medium flex items-center gap-1"
            >
              {locale === "es" ? "Ver detalle" : "View details"}
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ChannelBreakdown data={channelData} height={300} />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {locale === "es"
                  ? "Detalle por Canal"
                  : "Channel Detail"}
              </h3>
              {channelData.map((channel) => {
                const convRate =
                  channel.count > 0
                    ? Math.round((channel.converted / channel.count) * 100)
                    : 0
                return (
                  <div
                    key={channel.source}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="text-sm text-gray-700">
                        {channel.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{channel.count}</span>
                      <span className="text-veloce-600 font-medium">
                        {convRate}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

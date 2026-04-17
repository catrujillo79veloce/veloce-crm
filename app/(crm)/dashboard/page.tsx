"use client"

import { useEffect, useState } from "react"
import { Filter } from "lucide-react"
import StatsCards, { type StatsCardsData } from "@/components/dashboard/StatsCards"
import RecentActivity from "@/components/dashboard/RecentActivity"
import TasksDueToday from "@/components/dashboard/TasksDueToday"
import LeadFunnelChart from "@/components/dashboard/LeadFunnelChart"
import RevenuePipelineChart from "@/components/dashboard/RevenuePipelineChart"
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown"
import TeamPerformance from "@/components/dashboard/TeamPerformance"
import { useI18n } from "@/lib/i18n/config"
import {
  getDashboardKPIs,
  getRecentActivity,
  getTasksDueToday,
  getLeadFunnelData,
  getRevenueData,
  getChannelPerformanceData,
  getTeamPerformance,
  type RecentActivityItem,
  type TaskDueToday as TaskDueTodayType,
  type LeadFunnelItem,
  type RevenueDataPoint,
  type ChannelPerformanceItem,
  type TeamMemberPerformance,
} from "@/app/actions/analytics"

export default function DashboardPage() {
  const { t } = useI18n()
  const [kpis, setKpis] = useState<StatsCardsData | null>(null)
  const [activities, setActivities] = useState<RecentActivityItem[]>([])
  const [tasksDue, setTasksDue] = useState<TaskDueTodayType[]>([])
  const [funnelData, setFunnelData] = useState<LeadFunnelItem[]>([])
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([])
  const [channelData, setChannelData] = useState<ChannelPerformanceItem[]>([])
  const [teamData, setTeamData] = useState<TeamMemberPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiData, activityData, tasksData, funnel, revenue, channels, team] =
          await Promise.all([
            getDashboardKPIs(),
            getRecentActivity(10),
            getTasksDueToday(),
            getLeadFunnelData(),
            getRevenueData(6),
            getChannelPerformanceData(),
            getTeamPerformance(),
          ])

        setKpis(kpiData)
        setActivities(activityData)
        setTasksDue(tasksData)
        setFunnelData(funnel)
        setRevenueData(revenue)
        setChannelData(channels)
        setTeamData(team)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t.dashboard.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t.dashboard.thisWeek}</p>
      </div>

      {/* KPI Stats */}
      <StatsCards data={kpis} />

      {/* Two-column section: Activity + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity activities={activities} />
        <TasksDueToday tasks={tasksDue} />
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              {t.dashboard.leadFunnel}
            </h2>
          </div>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <LeadFunnelChart data={funnelData} />
          )}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t.dashboard.revenue}
            </h2>
          </div>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <RevenuePipelineChart data={revenueData} />
          )}
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t.analytics?.channelPerformance ||
                (t as any).nav?.analytics ||
                "Canales"}
            </h2>
          </div>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ChannelBreakdown data={channelData} />
          )}
        </div>
      </div>

      {/* Team Performance */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="h-[200px] flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-veloce-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : (
        <TeamPerformance team={teamData} />
      )}
    </div>
  )
}

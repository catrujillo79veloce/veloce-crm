"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Team performance (analytics per sales rep)
// ---------------------------------------------------------------------------

export interface TeamMemberPerformance {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
  active_leads: number
  won_deals_mtd: number
  won_revenue_mtd: number
  open_deals: number
  open_pipeline_value: number
  pending_tasks: number
  conversion_rate: number
}

export async function getTeamPerformance(): Promise<TeamMemberPerformance[]> {
  const supabase = createServerSupabaseClient()
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString()

  const { data: members } = await supabase
    .from("crm_team_members")
    .select("id, full_name, email, avatar_url, role")
    .eq("is_active", true)

  if (!members || members.length === 0) return []

  const results: TeamMemberPerformance[] = []

  for (const m of members) {
    const [
      activeLeadsRes,
      wonDealsMtdRes,
      openDealsRes,
      pendingTasksRes,
      totalDealsRes,
    ] = await Promise.all([
      supabase
        .from("crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.id)
        .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"]),
      supabase
        .from("crm_deals")
        .select("amount")
        .eq("assigned_to", m.id)
        .eq("stage", "closed_won")
        .gte("updated_at", startOfMonth),
      supabase
        .from("crm_deals")
        .select("amount")
        .eq("assigned_to", m.id)
        .in("stage", ["qualification", "proposal", "negotiation"]),
      supabase
        .from("crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.id)
        .neq("status", "done"),
      supabase
        .from("crm_deals")
        .select("stage", { count: "exact" })
        .eq("assigned_to", m.id)
        .in("stage", ["closed_won", "closed_lost"]),
    ])

    const wonRevenue =
      wonDealsMtdRes.data?.reduce(
        (sum, d) => sum + (Number(d.amount) || 0),
        0
      ) ?? 0

    const openPipeline =
      openDealsRes.data?.reduce(
        (sum, d) => sum + (Number(d.amount) || 0),
        0
      ) ?? 0

    const totalClosed = totalDealsRes.count ?? 0
    const won = totalDealsRes.data?.filter((d) => d.stage === "closed_won").length ?? 0
    const conversionRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0

    results.push({
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      avatar_url: m.avatar_url,
      role: m.role,
      active_leads: activeLeadsRes.count ?? 0,
      won_deals_mtd: wonDealsMtdRes.data?.length ?? 0,
      won_revenue_mtd: wonRevenue,
      open_deals: openDealsRes.data?.length ?? 0,
      open_pipeline_value: openPipeline,
      pending_tasks: pendingTasksRes.count ?? 0,
      conversion_rate: conversionRate,
    })
  }

  return results.sort((a, b) => b.won_revenue_mtd - a.won_revenue_mtd)
}

export interface DashboardKPIs {
  newLeadsThisWeek: number
  closedDealsThisMonth: number
  pipelineValue: number
  pendingTasks: number
  newLeadsChange: number
  closedDealsChange: number
  pipelineValueChange: number
  pendingTasksChange: number
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = createServerSupabaseClient()

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const startOfLastWeek = new Date(startOfWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // New leads this week
  const { count: newLeadsThisWeek } = await supabase
    .from("crm_leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfWeek.toISOString())

  // New leads last week (for comparison)
  const { count: newLeadsLastWeek } = await supabase
    .from("crm_leads")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfLastWeek.toISOString())
    .lt("created_at", startOfWeek.toISOString())

  // Closed deals this month
  const { count: closedDealsThisMonth } = await supabase
    .from("crm_deals")
    .select("*", { count: "exact", head: true })
    .eq("stage", "closed_won")
    .gte("closed_at", startOfMonth.toISOString())

  // Closed deals last month
  const { count: closedDealsLastMonth } = await supabase
    .from("crm_deals")
    .select("*", { count: "exact", head: true })
    .eq("stage", "closed_won")
    .gte("closed_at", startOfLastMonth.toISOString())
    .lte("closed_at", endOfLastMonth.toISOString())

  // Pipeline value (deals not closed)
  const { data: pipelineDeals } = await supabase
    .from("crm_deals")
    .select("amount")
    .not("stage", "in", '("closed_won","closed_lost")')

  const pipelineValue = (pipelineDeals || []).reduce(
    (sum, d) => sum + (d.amount || 0),
    0
  )

  // Pipeline value last month for comparison
  const { data: lastMonthPipeline } = await supabase
    .from("crm_deals")
    .select("amount")
    .not("stage", "in", '("closed_won","closed_lost")')
    .lt("created_at", startOfMonth.toISOString())

  const lastMonthPipelineValue = (lastMonthPipeline || []).reduce(
    (sum, d) => sum + (d.amount || 0),
    0
  )

  // Pending tasks
  const { count: pendingTasks } = await supabase
    .from("crm_tasks")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"])

  // Pending tasks last week
  const { count: pendingTasksLastWeek } = await supabase
    .from("crm_tasks")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"])
    .lt("created_at", startOfWeek.toISOString())

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100 * 10) / 10
  }

  return {
    newLeadsThisWeek: newLeadsThisWeek || 0,
    closedDealsThisMonth: closedDealsThisMonth || 0,
    pipelineValue,
    pendingTasks: pendingTasks || 0,
    newLeadsChange: calcChange(newLeadsThisWeek || 0, newLeadsLastWeek || 0),
    closedDealsChange: calcChange(
      closedDealsThisMonth || 0,
      closedDealsLastMonth || 0
    ),
    pipelineValueChange: calcChange(pipelineValue, lastMonthPipelineValue),
    pendingTasksChange: calcChange(
      pendingTasks || 0,
      pendingTasksLastWeek || 0
    ),
  }
}

export interface RecentActivityItem {
  id: string
  contact_name: string
  contact_id: string
  avatar_url: string | null
  type: string
  direction: string
  subject: string | null
  body: string | null
  occurred_at: string
}

export async function getRecentActivity(
  limit = 10
): Promise<RecentActivityItem[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_interactions")
    .select(
      `
      id,
      type,
      direction,
      subject,
      body,
      occurred_at,
      contact:crm_contacts!crm_interactions_contact_id_fkey(id, first_name, last_name, avatar_url)
    `
    )
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching recent activity:", error)
    return []
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    contact_name: item.contact
      ? `${item.contact.first_name} ${item.contact.last_name}`
      : "Desconocido",
    contact_id: item.contact?.id || "",
    avatar_url: item.contact?.avatar_url || null,
    type: item.type,
    direction: item.direction,
    subject: item.subject,
    body: item.body,
    occurred_at: item.occurred_at,
  }))
}

export interface TaskDueToday {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
  contact_name: string | null
  contact_id: string | null
}

export async function getTasksDueToday(): Promise<TaskDueToday[]> {
  const supabase = createServerSupabaseClient()

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const todayEnd = today.toISOString()

  const { data, error } = await supabase
    .from("crm_tasks")
    .select(
      `
      id,
      title,
      priority,
      due_date,
      status,
      contact:crm_contacts(id, first_name, last_name)
    `
    )
    .in("status", ["pending", "in_progress"])
    .lte("due_date", todayEnd)
    .order("due_date", { ascending: true })
    .limit(10)

  if (error) {
    console.error("Error fetching tasks due today:", error)
    return []
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    priority: item.priority,
    due_date: item.due_date,
    status: item.status,
    contact_name: item.contact
      ? `${item.contact.first_name} ${item.contact.last_name}`
      : null,
    contact_id: item.contact?.id || null,
  }))
}

export interface LeadFunnelItem {
  status: string
  label: string
  count: number
  color: string
}

export async function getLeadFunnelData(): Promise<LeadFunnelItem[]> {
  const supabase = createServerSupabaseClient()
  const { LEAD_STATUSES } = await import("@/lib/constants")

  const funnelStatuses = LEAD_STATUSES.filter(
    (s) => s.value !== "won" && s.value !== "lost"
  )

  const results: LeadFunnelItem[] = []

  for (const status of funnelStatuses) {
    const { count } = await supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", status.value)

    results.push({
      status: status.value,
      label: status.label.es,
      count: count || 0,
      color: status.color,
    })
  }

  return results
}

export interface RevenueDataPoint {
  month: string
  amount: number
}

export async function getRevenueData(
  period: number = 6
): Promise<RevenueDataPoint[]> {
  const supabase = createServerSupabaseClient()

  const months: RevenueDataPoint[] = []
  const now = new Date()

  for (let i = period - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const monthLabel = monthStart.toLocaleDateString("es-CO", {
      month: "short",
    })

    const { data } = await supabase
      .from("crm_deals")
      .select("amount")
      .eq("stage", "closed_won")
      .gte("closed_at", monthStart.toISOString())
      .lte("closed_at", monthEnd.toISOString())

    const totalAmount = (data || []).reduce(
      (sum, d) => sum + (d.amount || 0),
      0
    )

    months.push({
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      amount: totalAmount,
    })
  }

  return months
}

export interface ChannelPerformanceItem {
  source: string
  label: string
  count: number
  converted: number
  color: string
}

export async function getChannelPerformanceData(): Promise<
  ChannelPerformanceItem[]
> {
  const supabase = createServerSupabaseClient()
  const { CONTACT_SOURCES } = await import("@/lib/constants")

  const results: ChannelPerformanceItem[] = []

  for (const source of CONTACT_SOURCES) {
    const { count: totalCount } = await supabase
      .from("crm_contacts")
      .select("*", { count: "exact", head: true })
      .eq("source", source.value)

    const { count: convertedCount } = await supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("source", source.value)
      .eq("status", "won")

    if ((totalCount || 0) > 0) {
      results.push({
        source: source.value,
        label: source.label.es,
        count: totalCount || 0,
        converted: convertedCount || 0,
        color: source.color,
      })
    }
  }

  return results.sort((a, b) => b.count - a.count)
}

export interface SalesPerformanceData {
  dealsByMonth: { month: string; won: number; lost: number; total: number }[]
  dealsByStage: { stage: string; label: string; count: number; color: string }[]
  avgDealSize: number
  winRate: number
  totalRevenue: number
  totalDeals: number
}

export async function getSalesPerformanceData(): Promise<SalesPerformanceData> {
  const supabase = createServerSupabaseClient()
  const { DEAL_STAGES } = await import("@/lib/constants")

  const now = new Date()

  // Deals by month (last 6 months)
  const dealsByMonth: SalesPerformanceData["dealsByMonth"] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const monthLabel = monthStart.toLocaleDateString("es-CO", {
      month: "short",
    })

    const { count: wonCount } = await supabase
      .from("crm_deals")
      .select("*", { count: "exact", head: true })
      .eq("stage", "closed_won")
      .gte("closed_at", monthStart.toISOString())
      .lte("closed_at", monthEnd.toISOString())

    const { count: lostCount } = await supabase
      .from("crm_deals")
      .select("*", { count: "exact", head: true })
      .eq("stage", "closed_lost")
      .gte("closed_at", monthStart.toISOString())
      .lte("closed_at", monthEnd.toISOString())

    const { count: totalCount } = await supabase
      .from("crm_deals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())

    dealsByMonth.push({
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      won: wonCount || 0,
      lost: lostCount || 0,
      total: totalCount || 0,
    })
  }

  // Deals by stage
  const dealsByStage: SalesPerformanceData["dealsByStage"] = []
  for (const stage of DEAL_STAGES) {
    const { count } = await supabase
      .from("crm_deals")
      .select("*", { count: "exact", head: true })
      .eq("stage", stage.value)

    dealsByStage.push({
      stage: stage.value,
      label: stage.label.es,
      count: count || 0,
      color: stage.color,
    })
  }

  // Average deal size and win rate
  const { data: wonDeals } = await supabase
    .from("crm_deals")
    .select("amount")
    .eq("stage", "closed_won")

  const { count: totalClosedWon } = await supabase
    .from("crm_deals")
    .select("*", { count: "exact", head: true })
    .eq("stage", "closed_won")

  const { count: totalClosedLost } = await supabase
    .from("crm_deals")
    .select("*", { count: "exact", head: true })
    .eq("stage", "closed_lost")

  const totalRevenue = (wonDeals || []).reduce(
    (sum, d) => sum + (d.amount || 0),
    0
  )
  const totalWon = totalClosedWon || 0
  const totalLost = totalClosedLost || 0
  const avgDealSize = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0
  const winRate =
    totalWon + totalLost > 0
      ? Math.round((totalWon / (totalWon + totalLost)) * 100)
      : 0

  return {
    dealsByMonth,
    dealsByStage,
    avgDealSize,
    winRate,
    totalRevenue,
    totalDeals: totalWon + totalLost,
  }
}

export interface TeamLeaderboardItem {
  id: string
  name: string
  avatar_url: string | null
  closed_deals: number
  total_revenue: number
  leads_handled: number
}

export async function getTeamLeaderboardData(): Promise<
  TeamLeaderboardItem[]
> {
  const supabase = createServerSupabaseClient()

  const { data: members } = await supabase
    .from("crm_team_members")
    .select("id, full_name, avatar_url")
    .eq("is_active", true)

  if (!members || members.length === 0) return []

  const results: TeamLeaderboardItem[] = []

  for (const member of members) {
    const { count: closedDeals } = await supabase
      .from("crm_deals")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", member.id)
      .eq("stage", "closed_won")

    const { data: wonDeals } = await supabase
      .from("crm_deals")
      .select("amount")
      .eq("assigned_to", member.id)
      .eq("stage", "closed_won")

    const totalRevenue = (wonDeals || []).reduce(
      (sum, d) => sum + (d.amount || 0),
      0
    )

    const { count: leadsHandled } = await supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", member.id)

    results.push({
      id: member.id,
      name: member.full_name,
      avatar_url: member.avatar_url,
      closed_deals: closedDeals || 0,
      total_revenue: totalRevenue,
      leads_handled: leadsHandled || 0,
    })
  }

  return results.sort((a, b) => b.total_revenue - a.total_revenue)
}


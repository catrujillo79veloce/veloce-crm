"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Operations report — aggregates the modules built for Veloce: agenda,
// reservas, taller, bot/messaging, and review requests, over a date range.
// ---------------------------------------------------------------------------

export interface OperationsReport {
  agenda: {
    total: number
    scheduled: number
    completed: number
    cancelled: number
    upcoming: number
  }
  reservas: {
    total: number
    active: number
    completed: number
    cancelled: number
    depositsCollected: number
    valueReserved: number
  }
  taller: {
    total: number
    inProgress: number
    ready: number
    delivered: number
    revenue: number
  }
  mensajeria: {
    inbound: number
    outbound: number
    aiReplies: number
    reviewRequests: number
  }
}

function rangeBounds(from?: string, to?: string) {
  const start = from
    ? new Date(from)
    : new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const end = to ? new Date(to) : new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export async function getOperationsReport(
  from?: string,
  to?: string
): Promise<OperationsReport> {
  const supabase = createServerSupabaseClient()
  const { startIso, endIso } = rangeBounds(from, to)
  const nowIso = new Date().toISOString()

  const [appts, reservations, tickets, interactions, reviews] = await Promise.all([
    supabase
      .from("crm_appointments")
      .select("status, starts_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("crm_reservations")
      .select("status, deposit_cop, deposit_paid, total_price_cop")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("crm_service_tickets")
      .select("status, final_cost_cop")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("crm_interactions")
      .select("direction, channel_metadata")
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso),
    supabase
      .from("crm_review_requests")
      .select("id")
      .eq("status", "sent")
      .gte("sent_at", startIso)
      .lte("sent_at", endIso),
  ])

  const apptRows = appts.data ?? []
  const resRows = reservations.data ?? []
  const ticketRows = tickets.data ?? []
  const intRows = interactions.data ?? []

  const agenda = {
    total: apptRows.length,
    scheduled: apptRows.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
    completed: apptRows.filter((a) => a.status === "completed").length,
    cancelled: apptRows.filter((a) => a.status === "cancelled" || a.status === "no_show").length,
    upcoming: apptRows.filter(
      (a) =>
        (a.status === "scheduled" || a.status === "confirmed") &&
        (a.starts_at as string) >= nowIso
    ).length,
  }

  const reservas = {
    total: resRows.length,
    active: resRows.filter((r) => r.status === "pending_payment" || r.status === "reserved").length,
    completed: resRows.filter((r) => r.status === "completed").length,
    cancelled: resRows.filter((r) => r.status === "cancelled" || r.status === "expired").length,
    depositsCollected: resRows
      .filter((r) => r.deposit_paid)
      .reduce((sum, r) => sum + (Number(r.deposit_cop) || 0), 0),
    valueReserved: resRows
      .filter((r) => r.status === "pending_payment" || r.status === "reserved")
      .reduce((sum, r) => sum + (Number(r.total_price_cop) || 0), 0),
  }

  const taller = {
    total: ticketRows.length,
    inProgress: ticketRows.filter((t) => t.status === "received" || t.status === "in_progress").length,
    ready: ticketRows.filter((t) => t.status === "ready").length,
    delivered: ticketRows.filter((t) => t.status === "delivered").length,
    revenue: ticketRows
      .filter((t) => t.status === "delivered")
      .reduce((sum, t) => sum + (Number(t.final_cost_cop) || 0), 0),
  }

  const outboundRows = intRows.filter((i) => i.direction === "outbound")
  const mensajeria = {
    inbound: intRows.filter((i) => i.direction === "inbound").length,
    outbound: outboundRows.length,
    aiReplies: outboundRows.filter(
      (i) => (i.channel_metadata as { ai_generated?: boolean } | null)?.ai_generated
    ).length,
    reviewRequests: reviews.data?.length ?? 0,
  }

  return { agenda, reservas, taller, mensajeria }
}

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendReviewRequest } from "@/lib/ai/review-request"

// ---------------------------------------------------------------------------
// GET /api/cron/review-requests
//
// Scans for recently completed service events (delivered tickets, completed
// reservations) and sends a Google review request via WhatsApp once per event.
//
// Triggered by Vercel Cron (hourly). Protected by CRON_SECRET when configured.
// Respects the WhatsApp 24h window: only auto-sends to contacts who have an
// inbound message in the last 24h; others are skipped (use the manual button).
// ---------------------------------------------------------------------------

export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  // Check the feature is enabled + link configured
  const { data: settings } = await supabase
    .from("crm_app_settings")
    .select("key, value")
    .in("key", ["review_auto_send", "review_delay_hours", "google_review_link"])

  const settingMap = new Map(
    (settings ?? []).map((s) => [s.key, s.value as unknown])
  )
  const autoSend = settingMap.get("review_auto_send")
  const link = settingMap.get("google_review_link")

  if (autoSend === false) {
    return NextResponse.json({ status: "disabled" })
  }
  if (!link || typeof link !== "string" || link.trim().length === 0) {
    return NextResponse.json({ status: "no_review_link" })
  }

  const delayHours = Number(settingMap.get("review_delay_hours") ?? 3)
  const now = Date.now()
  const windowEnd = new Date(now - delayHours * 3600 * 1000).toISOString()
  const windowStart = new Date(now - 7 * 24 * 3600 * 1000).toISOString()
  const last24h = new Date(now - 24 * 3600 * 1000).toISOString()

  let sent = 0
  let skipped = 0

  // Helper: has the contact messaged us in the last 24h (WhatsApp window open)?
  async function windowOpen(contactId: string): Promise<boolean> {
    const { data } = await supabase
      .from("crm_interactions")
      .select("id")
      .eq("contact_id", contactId)
      .eq("direction", "inbound")
      .gte("occurred_at", last24h)
      .limit(1)
    return !!(data && data.length > 0)
  }

  // 1. Delivered tickets
  const { data: tickets } = await supabase
    .from("crm_service_tickets")
    .select("id, contact_id, delivered_at")
    .eq("status", "delivered")
    .gte("delivered_at", windowStart)
    .lte("delivered_at", windowEnd)

  for (const t of tickets ?? []) {
    const { data: already } = await supabase
      .from("crm_review_requests")
      .select("id")
      .eq("source_type", "ticket")
      .eq("source_id", t.id)
      .maybeSingle()
    if (already) continue

    if (!(await windowOpen(t.contact_id))) {
      skipped++
      continue
    }
    const res = await sendReviewRequest({
      supabase,
      contactId: t.contact_id,
      sourceType: "ticket",
      sourceId: t.id,
    })
    if (res.ok) sent++
    else skipped++
  }

  // 2. Completed reservations
  const { data: reservations } = await supabase
    .from("crm_reservations")
    .select("id, contact_id, completed_at")
    .eq("status", "completed")
    .gte("completed_at", windowStart)
    .lte("completed_at", windowEnd)

  for (const r of reservations ?? []) {
    const { data: already } = await supabase
      .from("crm_review_requests")
      .select("id")
      .eq("source_type", "reservation")
      .eq("source_id", r.id)
      .maybeSingle()
    if (already) continue

    if (!(await windowOpen(r.contact_id))) {
      skipped++
      continue
    }
    const res = await sendReviewRequest({
      supabase,
      contactId: r.contact_id,
      sourceType: "reservation",
      sourceId: r.id,
    })
    if (res.ok) sent++
    else skipped++
  }

  return NextResponse.json({ status: "ok", sent, skipped })
}

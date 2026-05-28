// ---------------------------------------------------------------------------
// Pipeline automation.
//
// Keeps each contact's lead in sync with reality, with no manual dragging:
//   - Creates a lead when a contact shows buying intent (hot tag) or puts
//     down a reservation.
//   - Advances the lead stage based on signals (never moves it backward, never
//     touches a won/lost lead):
//       outbound reply      → contacted
//       active reservation  → negotiation
//       completed reservation / closed-won deal → won
//
// Runs per-contact on key events (e.g. reservation created) and as a daily
// batch sweep over hot contacts.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"

const STATUS_ORDER: Record<LeadStatus, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  proposal: 3,
  negotiation: 4,
  won: 5,
  lost: 5,
}

const HOT_TAGS = ["interes_compra", "separar_bici", "agendar_visita"]

interface SyncResult {
  action: "none" | "created" | "advanced"
  status?: LeadStatus
}

/**
 * Evaluate a single contact and create/advance their lead accordingly.
 */
export async function syncContactPipeline(
  supabase: AdminClient,
  contactId: string
): Promise<SyncResult> {
  // --- Gather signals ---
  const [reservations, lastOutbound, hotTagged, openLead, contact] =
    await Promise.all([
      supabase
        .from("crm_reservations")
        .select("status, total_price_cop, product_name")
        .eq("contact_id", contactId),
      supabase
        .from("crm_interactions")
        .select("id")
        .eq("contact_id", contactId)
        .eq("direction", "outbound")
        .limit(1),
      isContactHot(supabase, contactId),
      supabase
        .from("crm_leads")
        .select("id, status, estimated_value")
        .eq("contact_id", contactId)
        .not("status", "in", "(won,lost)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("crm_contacts")
        .select("first_name, last_name")
        .eq("id", contactId)
        .maybeSingle(),
    ])

  const resRows = reservations.data ?? []
  const hasCompletedRes = resRows.some((r) => r.status === "completed")
  const activeRes = resRows.find(
    (r) => r.status === "pending_payment" || r.status === "reserved"
  )
  const hasOutbound = (lastOutbound.data?.length ?? 0) > 0
  const isHot = hotTagged

  // --- Determine target status ---
  let target: LeadStatus | null = null
  if (hasCompletedRes) target = "won"
  else if (activeRes) target = "negotiation"
  else if (hasOutbound && (isHot || resRows.length > 0)) target = "contacted"
  else if (isHot) target = "new"

  if (!target) return { action: "none" }

  const estimatedValue = activeRes
    ? Number(activeRes.total_price_cop) || null
    : resRows.find((r) => r.status === "completed")?.total_price_cop != null
      ? Number(resRows.find((r) => r.status === "completed")!.total_price_cop)
      : null

  const name = contact.data
    ? `${contact.data.first_name}${contact.data.last_name ? " " + contact.data.last_name : ""}`
    : "Cliente"
  const title = activeRes?.product_name
    ? `${activeRes.product_name} — ${name}`
    : `Interés de compra — ${name}`

  // --- No open lead → create (only for meaningful signals) ---
  if (!openLead.data) {
    const { error } = await supabase.from("crm_leads").insert({
      contact_id: contactId,
      title,
      status: target,
      priority: target === "negotiation" || target === "won" ? "high" : "medium",
      source: "whatsapp",
      estimated_value: estimatedValue,
      last_contacted_at: hasOutbound ? new Date().toISOString() : null,
      closed_at: target === "won" ? new Date().toISOString() : null,
    })
    if (error) {
      console.error("[Pipeline] Lead create failed:", error)
      return { action: "none" }
    }
    return { action: "created", status: target }
  }

  // --- Open lead exists → advance only forward ---
  const current = openLead.data.status as LeadStatus
  if (STATUS_ORDER[target] > STATUS_ORDER[current]) {
    const updates: Record<string, unknown> = { status: target }
    if (target === "won") updates.closed_at = new Date().toISOString()
    if (estimatedValue && !openLead.data.estimated_value)
      updates.estimated_value = estimatedValue
    if (hasOutbound) updates.last_contacted_at = new Date().toISOString()

    const { error } = await supabase
      .from("crm_leads")
      .update(updates)
      .eq("id", openLead.data.id)
    if (error) {
      console.error("[Pipeline] Lead advance failed:", error)
      return { action: "none" }
    }
    return { action: "advanced", status: target }
  }

  return { action: "none" }
}

async function isContactHot(
  supabase: AdminClient,
  contactId: string
): Promise<boolean> {
  const { data: tags } = await supabase
    .from("crm_tags")
    .select("id")
    .in("name", HOT_TAGS)
  const tagIds = (tags ?? []).map((t) => t.id)
  if (tagIds.length === 0) return false

  const { data } = await supabase
    .from("crm_contact_tags")
    .select("contact_id")
    .eq("contact_id", contactId)
    .in("tag_id", tagIds)
    .limit(1)
  return (data?.length ?? 0) > 0
}

/**
 * Daily batch: sweep all hot-tagged contacts and sync their pipeline.
 */
export async function runPipelineAutomation(
  supabase: AdminClient
): Promise<{ created: number; advanced: number }> {
  const { data: tags } = await supabase
    .from("crm_tags")
    .select("id")
    .in("name", HOT_TAGS)
  const tagIds = (tags ?? []).map((t) => t.id)
  if (tagIds.length === 0) return { created: 0, advanced: 0 }

  const { data: tagged } = await supabase
    .from("crm_contact_tags")
    .select("contact_id")
    .in("tag_id", tagIds)

  const contactIds = Array.from(
    new Set((tagged ?? []).map((r) => r.contact_id as string))
  )

  let created = 0
  let advanced = 0
  for (const id of contactIds) {
    const res = await syncContactPipeline(supabase, id)
    if (res.action === "created") created++
    else if (res.action === "advanced") advanced++
  }
  return { created, advanced }
}

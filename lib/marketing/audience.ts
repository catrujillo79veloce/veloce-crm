// ---------------------------------------------------------------------------
// Marketing audience resolver.
//
// Turns a saved audience filter into a list of contact IDs that have a
// WhatsApp number. For freeform campaigns, the send step further restricts to
// contacts active in the last 24h (WhatsApp policy).
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export interface AudienceFilter {
  tags?: string[] // tag names (any-of)
  source?: string // crm_contact_source
  city?: string
  /** Pre-computed contact IDs (used by lifecycle automations & saved lists). */
  contact_ids?: string[]
  /** Marker so we can show an "Automático" badge in the UI. Resolver ignores. */
  lifecycle_rule?: "winback_90d" | "overhaul_1y" | "birthday"
}

export interface AudienceContact {
  id: string
  first_name: string
  whatsapp_phone: string
}

export async function resolveAudience(
  supabase: AdminClient,
  filter: AudienceFilter
): Promise<AudienceContact[]> {
  // Short-circuit for pre-computed audiences (lifecycle / saved lists).
  if (filter.contact_ids && filter.contact_ids.length > 0) {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, first_name, whatsapp_phone")
      .in("id", filter.contact_ids)
      .not("whatsapp_phone", "is", null)
      .neq("whatsapp_phone", "")
      .limit(2000)
    return (data ?? []).filter((c) => c.whatsapp_phone) as AudienceContact[]
  }

  // If tags are specified, start from contacts carrying any of those tags.
  let contactIdFilter: string[] | null = null
  if (filter.tags && filter.tags.length > 0) {
    const { data: tags } = await supabase
      .from("crm_tags")
      .select("id")
      .in("name", filter.tags)
    const tagIds = (tags ?? []).map((t) => t.id)
    if (tagIds.length === 0) return []
    const { data: tagged } = await supabase
      .from("crm_contact_tags")
      .select("contact_id")
      .in("tag_id", tagIds)
    contactIdFilter = Array.from(
      new Set((tagged ?? []).map((r) => r.contact_id as string))
    )
    if (contactIdFilter.length === 0) return []
  }

  let query = supabase
    .from("crm_contacts")
    .select("id, first_name, whatsapp_phone")
    .not("whatsapp_phone", "is", null)
    .neq("whatsapp_phone", "")

  if (filter.source) query = query.eq("source", filter.source)
  if (filter.city) query = query.ilike("city", `%${filter.city}%`)
  if (contactIdFilter) query = query.in("id", contactIdFilter)

  const { data } = await query.limit(2000)
  return (data ?? []).filter((c) => c.whatsapp_phone) as AudienceContact[]
}

/** Contact IDs with an inbound message in the last 24h (freeform-eligible). */
export async function activeWithin24h(
  supabase: AdminClient,
  contactIds: string[]
): Promise<Set<string>> {
  if (contactIds.length === 0) return new Set()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from("crm_interactions")
    .select("contact_id")
    .in("contact_id", contactIds)
    .eq("direction", "inbound")
    .gte("occurred_at", since)
  return new Set((data ?? []).map((r) => r.contact_id as string))
}

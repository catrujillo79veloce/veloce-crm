// ---------------------------------------------------------------------------
// Follow-up engine.
//
// Auto-creates follow-up TASKS (crm_tasks with task_type='followup') for hot
// leads that have gone quiet, so no interested customer slips through the
// cracks. Also builds the daily digest text for the admin.
//
// "Hot" = contact carries one of the buying-intent tags applied by the intent
// classifier (interes_compra, separar_bici, agendar_visita).
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

const HOT_TAGS = ["interes_compra", "separar_bici", "agendar_visita"]

interface GenerateResult {
  created: number
  skipped: number
}

async function getSetting(supabase: AdminClient, key: string): Promise<unknown> {
  const { data } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle()
  return data?.value ?? null
}

/**
 * Scan hot leads and create follow-up tasks for ones that have gone quiet.
 */
export async function generateFollowups(
  supabase: AdminClient
): Promise<GenerateResult> {
  const autoCreate = await getSetting(supabase, "followup_auto_create")
  if (autoCreate === false) return { created: 0, skipped: 0 }

  const staleDays = Number((await getSetting(supabase, "followup_stale_days")) ?? 2)
  const now = Date.now()
  const staleBefore = new Date(now - staleDays * 24 * 3600 * 1000).toISOString()
  const notTooOld = new Date(now - 21 * 24 * 3600 * 1000).toISOString()

  // 1. Resolve hot tag IDs
  const { data: tags } = await supabase
    .from("crm_tags")
    .select("id, name")
    .in("name", HOT_TAGS)

  const tagIds = (tags ?? []).map((t) => t.id)
  if (tagIds.length === 0) return { created: 0, skipped: 0 }

  // 2. Contacts carrying a hot tag
  const { data: tagged } = await supabase
    .from("crm_contact_tags")
    .select("contact_id")
    .in("tag_id", tagIds)

  const contactIds = Array.from(
    new Set((tagged ?? []).map((r) => r.contact_id as string))
  )
  if (contactIds.length === 0) return { created: 0, skipped: 0 }

  let created = 0
  let skipped = 0

  for (const contactId of contactIds) {
    // Skip if a pending follow-up task already exists
    const { data: existing } = await supabase
      .from("crm_tasks")
      .select("id")
      .eq("contact_id", contactId)
      .eq("task_type", "followup")
      .in("status", ["pending", "in_progress"])
      .limit(1)
    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    // Skip if the contact already has an active reservation or appointment
    const { data: activeRes } = await supabase
      .from("crm_reservations")
      .select("id")
      .eq("contact_id", contactId)
      .in("status", ["pending_payment", "reserved"])
      .limit(1)
    if (activeRes && activeRes.length > 0) {
      skipped++
      continue
    }

    // Last interaction: must be in the stale window (quiet for staleDays,
    // but not older than 21 days — beyond that it's cold, not a follow-up)
    const { data: lastInts } = await supabase
      .from("crm_interactions")
      .select("occurred_at, direction")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false })
      .limit(1)

    const last = lastInts?.[0]
    if (!last) {
      skipped++
      continue
    }
    const lastAt = last.occurred_at as string
    if (lastAt > staleBefore || lastAt < notTooOld) {
      // Too fresh (still in conversation) or too old (cold)
      skipped++
      continue
    }

    // Fetch contact name for the task title
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("first_name, last_name")
      .eq("id", contactId)
      .maybeSingle()
    const name = contact
      ? `${contact.first_name}${contact.last_name ? " " + contact.last_name : ""}`
      : "Cliente"

    const { error } = await supabase.from("crm_tasks").insert({
      title: `Seguir cliente interesado: ${name}`,
      description:
        "Lead con intención de compra que lleva días sin responder. Escríbele para retomar y cerrar.",
      contact_id: contactId,
      status: "pending",
      priority: "high",
      due_date: new Date().toISOString(),
      task_type: "followup",
      source: "auto",
    })

    if (error) {
      console.error("[Followups] Insert failed:", error)
      skipped++
    } else {
      created++
    }
  }

  return { created, skipped }
}

/**
 * Build a short digest of follow-up tasks due today / overdue.
 * Returns null if there's nothing to report.
 */
export async function buildFollowupDigest(
  supabase: AdminClient
): Promise<string | null> {
  const enabled = await getSetting(supabase, "followup_digest_enabled")
  if (enabled === false) return null

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select("title, due_date, contact:crm_contacts ( first_name, last_name )")
    .eq("task_type", "followup")
    .in("status", ["pending", "in_progress"])
    .lte("due_date", endOfToday.toISOString())
    .order("due_date", { ascending: true })
    .limit(20)

  if (!tasks || tasks.length === 0) return null

  const names = tasks
    .slice(0, 6)
    .map((t) => {
      const c = t.contact as { first_name?: string; last_name?: string } | null
      return c ? `• ${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "• Cliente"
    })
    .join("\n")

  const extra = tasks.length > 6 ? `\n…y ${tasks.length - 6} más` : ""

  return (
    `📋 *Seguimientos pendientes (${tasks.length})*\n\n` +
    `Clientes interesados que vale la pena retomar hoy:\n${names}${extra}\n\n` +
    `Revisa todos en el CRM → Tareas.`
  )
}

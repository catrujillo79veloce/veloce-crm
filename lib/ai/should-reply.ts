// ---------------------------------------------------------------------------
// AI reply gate — decides whether the bot should auto-respond
//
// Two signals:
//   1. Global pause flag in crm_app_settings (Carlos turns this on when he's
//      at the store attending in person and wants ALL bot replies off).
//   2. Per-contact ai_enabled flag (auto-set to false when a team member
//      sends an outbound message from the CRM inbox — "AI takeover").
//
// The function is called inside each webhook AFTER the inbound is saved
// and BEFORE generateAgentResponse. Returns true only if BOTH gates pass.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

export async function shouldAIReply(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
): Promise<{ ok: boolean; reason?: string }> {
  // --- Global pause check ---
  const { data: setting } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", "ai_globally_paused")
    .maybeSingle()

  if (setting?.value === true) {
    return { ok: false, reason: "global_pause" }
  }

  // --- Per-contact check ---
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("ai_enabled")
    .eq("id", contactId)
    .single()

  if (contact?.ai_enabled === false) {
    return { ok: false, reason: "contact_takeover" }
  }

  return { ok: true }
}

/**
 * Mark AI as paused for this contact. Called from the 3 outbound send
 * routes after a successful human-initiated send.
 */
export async function pauseAIForContact(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
): Promise<void> {
  await supabase
    .from("crm_contacts")
    .update({
      ai_enabled: false,
      ai_paused_at: new Date().toISOString(),
    })
    .eq("id", contactId)
}

/**
 * Re-enable AI for this contact. Used by the UI toggle.
 */
export async function resumeAIForContact(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
): Promise<void> {
  await supabase
    .from("crm_contacts")
    .update({
      ai_enabled: true,
      ai_paused_at: null,
    })
    .eq("id", contactId)
}

// ---------------------------------------------------------------------------
// AI reply gate — decides whether the bot should auto-respond
//
// Two signals:
//   1. Global pause flag in crm_app_settings (Carlos turns this on when he's
//      at the store attending in person and wants ALL bot replies off).
//   2. Per-contact ai_enabled flag (auto-set to false when a team member
//      sends an outbound message from the CRM inbox — "AI takeover"), which
//      now EXPIRES after TAKEOVER_EXPIRY_DAYS of no human activity.
//
// The function is called inside each webhook AFTER the inbound is saved
// and BEFORE generateAgentResponse. Returns true only if BOTH gates pass.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

/**
 * How long a human takeover silences the bot for one contact.
 *
 * It used to be forever: `ai_paused_at` was written on every human reply and
 * never read again, so answering a customer by hand once muted the bot for
 * that customer permanently. Fourteen contacts had been stuck that way, the
 * oldest since June, growing by about seven a month — each one a returning
 * customer who got no reply at night or on a weekend.
 *
 * The clock restarts on every human message (pauseAIForContact rewrites
 * ai_paused_at), so an actively-handled conversation is never taken over by
 * the bot mid-flight; only genuinely dormant ones come back.
 */
const TAKEOVER_EXPIRY_DAYS = 7

export async function shouldAIReply(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
): Promise<{ ok: boolean; reason?: string }> {
  // --- Global pause check ---
  // Fail CLOSED: a database hiccup must not override a kill switch. Staying
  // quiet costs one delayed reply; ignoring the switch means the bot answers
  // customers while Carlos is attending them in person.
  const { data: setting, error: settingError } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", "ai_globally_paused")
    .maybeSingle()

  if (settingError) {
    console.error("[ShouldAIReply] Global pause lookup failed:", settingError)
    return { ok: false, reason: "settings_unreadable" }
  }
  if (setting?.value === true) {
    return { ok: false, reason: "global_pause" }
  }

  // --- Per-contact check ---
  const { data: contact, error: contactError } = await supabase
    .from("crm_contacts")
    .select("ai_enabled, ai_paused_at")
    .eq("id", contactId)
    .single()

  if (contactError || !contact) {
    console.error("[ShouldAIReply] Contact lookup failed:", contactError)
    return { ok: false, reason: "contact_unreadable" }
  }

  if (contact.ai_enabled === false) {
    const pausedAt = contact.ai_paused_at
      ? new Date(contact.ai_paused_at).getTime()
      : null

    // No timestamp means we can't tell how old the takeover is — leave it be.
    if (pausedAt === null) {
      return { ok: false, reason: "contact_takeover" }
    }

    const expiryMs = TAKEOVER_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    if (Date.now() - pausedAt < expiryMs) {
      return { ok: false, reason: "contact_takeover" }
    }

    await resumeAIForContact(supabase, contactId)
    console.log(
      `[ShouldAIReply] Takeover expired after ${TAKEOVER_EXPIRY_DAYS}d — AI resumed for ${contactId}`
    )
  }

  return { ok: true }
}

/**
 * Mark AI as paused for this contact. Called from the 3 outbound send
 * routes after a successful human-initiated send, and by the UI toggle.
 * Rewriting ai_paused_at restarts the takeover clock.
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
 * Re-enable AI for this contact. Used by the UI toggle and by the takeover
 * expiry above.
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

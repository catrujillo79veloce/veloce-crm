// ---------------------------------------------------------------------------
// Google review request sender.
//
// Sends a friendly WhatsApp asking a happy customer to leave a Google review,
// including the store's direct review link. Logs every attempt in
// crm_review_requests so we never ask twice for the same source event.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp"

type AdminClient = ReturnType<typeof createAdminClient>

export interface ReviewRequestInput {
  supabase: AdminClient
  contactId: string
  sourceType: "ticket" | "reservation" | "deal" | "manual"
  sourceId?: string | null
}

async function getSetting(
  supabase: AdminClient,
  key: string
): Promise<unknown> {
  const { data } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle()
  return data?.value ?? null
}

function buildMessage(firstName: string, link: string): string {
  const name = firstName && firstName !== "Instagram" ? `${firstName}, ` : ""
  return (
    `Hola ${name}gracias por confiar en Veloce! 🚴\n\n` +
    `Nos ayudarias muchisimo dejandonos una reseña en Google. ` +
    `Solo te toma 30 segundos y nos ayuda a seguir creciendo:\n\n` +
    `${link}\n\n` +
    `Mil gracias! Cualquier cosa aqui estamos. 💚`
  )
}

/**
 * Send a review request to a contact. Returns the outcome.
 * Idempotent per (sourceType, sourceId): if already requested, skips.
 */
export async function sendReviewRequest({
  supabase,
  contactId,
  sourceType,
  sourceId = null,
}: ReviewRequestInput): Promise<{ ok: boolean; reason?: string }> {
  // 1. Review link configured?
  const link = (await getSetting(supabase, "google_review_link")) as string | null
  if (!link || typeof link !== "string" || link.trim().length === 0) {
    return { ok: false, reason: "no_review_link" }
  }

  // 2. Already requested for this source?
  if (sourceId) {
    const { data: existing } = await supabase
      .from("crm_review_requests")
      .select("id")
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .maybeSingle()
    if (existing) return { ok: false, reason: "already_requested" }
  }

  // 3. Load contact phone
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("first_name, whatsapp_phone, phone")
    .eq("id", contactId)
    .maybeSingle()

  const phone = contact?.whatsapp_phone ?? contact?.phone ?? null
  if (!phone) {
    await logRequest(supabase, contactId, sourceType, sourceId, "skipped", "no_phone")
    return { ok: false, reason: "no_phone" }
  }

  // 4. Send
  const message = buildMessage(contact?.first_name ?? "", link.trim())
  const sent = await sendWhatsAppMessage(phone, message)

  await logRequest(
    supabase,
    contactId,
    sourceType,
    sourceId,
    sent.ok ? "sent" : "failed",
    sent.ok ? null : sent.error ?? "send_failed"
  )

  // Also log as an interaction so it shows in the conversation thread
  if (sent.ok) {
    await supabase.from("crm_interactions").insert({
      contact_id: contactId,
      type: "whatsapp_message",
      direction: "outbound",
      body: message,
      channel_metadata: { review_request: true, source_type: sourceType },
      occurred_at: new Date().toISOString(),
    })
  }

  return sent.ok ? { ok: true } : { ok: false, reason: sent.error }
}

async function logRequest(
  supabase: AdminClient,
  contactId: string,
  sourceType: string,
  sourceId: string | null,
  status: string,
  error: string | null
) {
  await supabase
    .from("crm_review_requests")
    .insert({
      contact_id: contactId,
      source_type: sourceType,
      source_id: sourceId,
      status,
      error,
    })
    .then(undefined, () => {
      /* ignore unique-violation races */
    })
}

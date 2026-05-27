// ---------------------------------------------------------------------------
// Admin notification with per-contact debounce
//
// Pings ADMIN_ALERT_PHONE via WhatsApp every time a new inbound message
// arrives — but only ONCE per contact per 15 minutes. A customer hammering
// 5 messages in 30 seconds = 1 ping, not 5.
//
// Distinct from hot-detector.ts, which only pings on buying-intent keywords.
// This one pings on every conversation regardless of content.
// ---------------------------------------------------------------------------

import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp"
import type { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"
const CRM_BASE_URL =
  process.env.NEXT_PUBLIC_CRM_BASE_URL ?? "https://crm.bicicletasveloce.com"
const DEBOUNCE_MINUTES = 15

type Channel = "whatsapp" | "instagram" | "facebook"

interface NotifyParams {
  supabase: ReturnType<typeof createAdminClient>
  contactId: string
  contactName: string
  channel: Channel
  message: string
  /**
   * If the hot-detector already sent a ping for this same message,
   * skip the generic notification to avoid double-pinging.
   */
  skip?: boolean
}

const CHANNEL_EMOJI: Record<Channel, string> = {
  whatsapp: "💬",
  instagram: "📸",
  facebook: "💙",
}

/**
 * Send a debounced admin ping for a new inbound message.
 * Returns true if a ping was sent, false if debounced.
 */
export async function notifyAdminOfNewMessage(
  params: NotifyParams
): Promise<boolean> {
  const { supabase, contactId, contactName, channel, message, skip } = params

  if (skip) return false

  // --- Debounce check ---
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("last_admin_notified_at")
    .eq("id", contactId)
    .single()

  const lastNotified = contact?.last_admin_notified_at
    ? new Date(contact.last_admin_notified_at).getTime()
    : 0
  const cutoff = Date.now() - DEBOUNCE_MINUTES * 60 * 1000

  if (lastNotified > cutoff) {
    console.log(
      `[NotifyAdmin] Skipped (debounced) for contact ${contactId} — last ping was ${Math.round((Date.now() - lastNotified) / 60000)} min ago`
    )
    return false
  }

  // --- Build the ping ---
  const preview =
    message.length > 180 ? message.slice(0, 180) + "..." : message

  const emoji = CHANNEL_EMOJI[channel]
  const alert = `${emoji} *Mensaje nuevo de ${channel.toUpperCase()}*

👤 *${contactName}*
📝 "${preview}"

🔗 ${CRM_BASE_URL}/inbox`

  // --- Send ---
  const result = await sendWhatsAppMessage(ADMIN_PHONE, alert)

  if (!result.ok) {
    console.error("[NotifyAdmin] Send failed:", result.error)
    return false
  }

  // --- Update debounce timestamp ---
  await supabase
    .from("crm_contacts")
    .update({ last_admin_notified_at: new Date().toISOString() })
    .eq("id", contactId)

  console.log(`[NotifyAdmin] Pinged admin about ${contactName} (${channel})`)
  return true
}

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
import { sendPush } from "@/lib/push/send"
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

  // --- Push notification to all team devices (fire-and-forget) ---
  sendPush(
    {
      title: `${emoji} ${contactName}`,
      body: preview,
      url: "/inbox",
      tag: `contact-${contactId}`,
    }
  ).catch((e) => console.error("[NotifyAdmin] Push failed:", e))

  // --- Send WhatsApp ping ---
  const result = await sendWhatsAppMessage(ADMIN_PHONE, alert)

  if (!result.ok) {
    console.error("[NotifyAdmin] Send failed:", result.error)
    // Push may still have succeeded; treat the debounce as consumed only
    // when the WhatsApp ping went through (push is best-effort).
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

// ---------------------------------------------------------------------------
// System-failure alert (NOT per-contact): fires when something is broken that
// would otherwise fail silently — the AI bot erroring, a Meta send token
// expiring, etc. This is the missing piece that let the bot stay down for 2
// days unnoticed. Debounced in-memory per failure-kind so an outage pings
// once every few minutes instead of on every message.
// ---------------------------------------------------------------------------

const FAILURE_DEBOUNCE_MINUTES = 10
const lastFailureAlertAt = new Map<string, number>()

/**
 * Alert the operator that a system component is failing. Best-effort across two
 * channels (WhatsApp + push) so a single dead channel doesn't hide the outage.
 * `kind` is a short, stable label used for debouncing (e.g. "Bot de IA caído").
 */
export async function alertAdminSystemFailure(
  kind: string,
  detail: string
): Promise<void> {
  const now = Date.now()
  const last = lastFailureAlertAt.get(kind) ?? 0
  if (now - last < FAILURE_DEBOUNCE_MINUTES * 60 * 1000) return
  lastFailureAlertAt.set(kind, now)

  const alert = `🚨 *Falla del CRM Veloce*

⚠️ *${kind}*
${detail}

🔗 ${CRM_BASE_URL}/inbox`

  // Push to team devices (independent channel, best-effort)
  sendPush({
    title: `🚨 ${kind}`,
    body: detail.slice(0, 180),
    url: "/inbox",
    tag: `sysfail-${kind}`,
  }).catch((e) => console.error("[AlertAdmin] Push failed:", e))

  // WhatsApp ping to the admin (independent of Anthropic / the broken channel)
  try {
    const result = await sendWhatsAppMessage(ADMIN_PHONE, alert)
    if (!result.ok) {
      console.error(`[AlertAdmin] WhatsApp ping failed for "${kind}":`, result.error)
    }
  } catch (e) {
    console.error(`[AlertAdmin] WhatsApp ping threw for "${kind}":`, e)
  }
}

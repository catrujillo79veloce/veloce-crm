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
// The WhatsApp ping is noisy (it lands in the operator's own chat list), so it
// stays heavily debounced. Push is the primary alert and is silent-by-design,
// so it gets a much shorter window — a customer writing again 3 minutes later
// is new information, not spam.
const DEBOUNCE_MINUTES = 15
const PUSH_DEBOUNCE_SECONDS = 60

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

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("last_admin_notified_at, last_push_notified_at")
    .eq("id", contactId)
    .single()

  const preview =
    message.length > 180 ? message.slice(0, 180) + "..." : message
  const emoji = CHANNEL_EMOJI[channel]
  const now = Date.now()

  // --- Push to every team device ---------------------------------------
  // This runs even when the hot-lead alert already fired via WhatsApp (that
  // path pushes its own 🔥 notification) and even when the WhatsApp ping is
  // debounced. Push is the alert that reaches a phone that isn't looking at
  // the CRM, so silencing it was what made new messages go unnoticed.
  const lastPush = contact?.last_push_notified_at
    ? new Date(contact.last_push_notified_at).getTime()
    : 0

  if (!skip && now - lastPush > PUSH_DEBOUNCE_SECONDS * 1000) {
    // Awaited on purpose: Vercel freezes the function once the webhook
    // responds, which can kill an un-awaited push mid-flight.
    const push = await sendPush({
      title: `${emoji} ${contactName}`,
      body: preview,
      url: "/inbox",
      tag: `contact-${contactId}`,
      urgency: "high",
    }).catch((e) => {
      console.error("[NotifyAdmin] Push failed:", e)
      return null
    })

    if (push && push.sent > 0) {
      await supabase
        .from("crm_contacts")
        .update({ last_push_notified_at: new Date().toISOString() })
        .eq("id", contactId)
    }
  }

  // --- WhatsApp ping to the operator ------------------------------------
  if (skip) return false

  const lastNotified = contact?.last_admin_notified_at
    ? new Date(contact.last_admin_notified_at).getTime()
    : 0
  const cutoff = now - DEBOUNCE_MINUTES * 60 * 1000

  if (lastNotified > cutoff) {
    console.log(
      `[NotifyAdmin] WhatsApp ping debounced for contact ${contactId} — last one was ${Math.round((now - lastNotified) / 60000)} min ago`
    )
    return false
  }

  const alert = `${emoji} *Mensaje nuevo de ${channel.toUpperCase()}*

👤 *${contactName}*
📝 "${preview}"

🔗 ${CRM_BASE_URL}/inbox`

  const result = await sendWhatsAppMessage(ADMIN_PHONE, alert)

  if (!result.ok) {
    console.error("[NotifyAdmin] WhatsApp ping failed:", result.error)
    return false
  }

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

  // Both channels, awaited — an outage alert that gets frozen mid-flight by
  // the serverless runtime is exactly the failure this function exists to stop.
  const [push, wa] = await Promise.allSettled([
    sendPush({
      title: `🚨 ${kind}`,
      body: detail.slice(0, 180),
      url: "/inbox",
      tag: `sysfail-${kind}`,
      urgency: "high",
    }),
    sendWhatsAppMessage(ADMIN_PHONE, alert),
  ])

  if (push.status === "rejected") {
    console.error(`[AlertAdmin] Push threw for "${kind}":`, push.reason)
  }
  if (wa.status === "rejected") {
    console.error(`[AlertAdmin] WhatsApp ping threw for "${kind}":`, wa.reason)
  } else if (!wa.value.ok) {
    console.error(`[AlertAdmin] WhatsApp ping failed for "${kind}":`, wa.value.error)
  }
}

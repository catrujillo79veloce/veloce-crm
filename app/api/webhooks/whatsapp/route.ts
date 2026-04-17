import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { parseWhatsAppWebhook, sendWhatsAppMessage } from "@/lib/integrations/whatsapp"
import { normalizePhone } from "@/lib/utils"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"

// Allow up to 60s for AI response generation + WhatsApp send
export const maxDuration = 60

// Admin phone to receive hot alerts
const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"

// ---------------------------------------------------------------------------
// GET - Webhook verification
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WhatsApp] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive messages, save to CRM, generate AI response, send reply
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? ""

  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process: save to CRM + generate AI response + send reply
  try {
    await processAndReply(body)
  } catch (err) {
    console.error("[WhatsApp] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Main processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAndReply(body: any) {
  const messages = parseWhatsAppWebhook(body)
  if (messages.length === 0) return

  const supabase = createAdminClient()

  for (const msg of messages) {
    try {
      const normalizedPhone = normalizePhone(msg.phone)

      // --- Deduplication ---
      const { data: existing } = await supabase
        .from("crm_interactions")
        .select("id")
        .eq("channel_message_id", msg.messageId)
        .limit(1)

      if (existing && existing.length > 0) continue

      // --- Upsert contact ---
      let contactId: string

      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("whatsapp_phone", normalizedPhone)
        .limit(1)

      if (existingContact && existingContact.length > 0) {
        contactId = existingContact[0].id
        await supabase
          .from("crm_contacts")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", contactId)
      } else {
        const firstName = msg.senderName?.split(" ")[0] ?? normalizedPhone
        const lastName = msg.senderName?.split(" ").slice(1).join(" ") ?? ""

        const { data: newContact, error: contactError } = await supabase
          .from("crm_contacts")
          .insert({
            first_name: firstName,
            last_name: lastName,
            whatsapp_phone: normalizedPhone,
            phone: normalizedPhone,
            source: "whatsapp",
            city: "Medellin",
            status: "active",
            interests: [],
          })
          .select("id")
          .single()

        if (contactError || !newContact) {
          console.error("[WhatsApp] Contact creation failed:", contactError)
          continue
        }
        contactId = newContact.id
        console.log("[WhatsApp] New contact:", contactId)
      }

      // --- Save inbound message ---
      const occurredAt = msg.timestamp
        ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString()

      await supabase.from("crm_interactions").insert({
        contact_id: contactId,
        type: "whatsapp_message",
        direction: "inbound",
        body: msg.message,
        channel_message_id: msg.messageId,
        channel_metadata: { phone: msg.phone, sender_name: msg.senderName ?? null },
        occurred_at: occurredAt,
      })

      console.log("[WhatsApp] Inbound saved for:", contactId)

      // --- HOT ALERT: notify admin if message shows buying intent ---
      const detection = detectHotMessage(msg.message)
      if (detection.isHot && ADMIN_PHONE !== normalizedPhone.replace(/\+/g, "")) {
        const contactName = msg.senderName ?? normalizedPhone
        sendHotAlert({
          adminPhone: ADMIN_PHONE,
          contactName,
          contactId,
          channel: "whatsapp",
          message: msg.message,
          detection,
        }).catch((e) => console.error("[WhatsApp] Hot alert failed:", e))
      }

      // --- Get conversation history for context ---
      const { data: history } = await supabase
        .from("crm_interactions")
        .select("direction, body")
        .eq("contact_id", contactId)
        .eq("type", "whatsapp_message")
        .order("occurred_at", { ascending: true })
        .limit(10)

      const conversationHistory = (history ?? [])
        .filter((h) => h.body)
        .map((h) => ({
          role: (h.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
          content: h.body as string,
        }))

      // --- Generate AI response ---
      const aiResponse = await generateAgentResponse(msg.message, conversationHistory)

      // --- Send reply via WhatsApp API ---
      const sent = await sendWhatsAppMessage(normalizedPhone, aiResponse)

      if (sent) {
        // Save outbound message in CRM
        await supabase.from("crm_interactions").insert({
          contact_id: contactId,
          type: "whatsapp_message",
          direction: "outbound",
          body: aiResponse,
          channel_metadata: { ai_generated: true },
          occurred_at: new Date().toISOString(),
        })
        console.log("[WhatsApp] AI replied to:", contactId)
      } else {
        console.error("[WhatsApp] Failed to send reply to:", normalizedPhone)
      }
    } catch (error) {
      console.error("[WhatsApp] Error:", error)
    }
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { parseWhatsAppWebhook } from "@/lib/integrations/whatsapp"
import { normalizePhone } from "@/lib/utils"

// ---------------------------------------------------------------------------
// GET - Webhook verification (Meta sends this during setup)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WhatsApp Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[WhatsApp Webhook] Verification failed - token mismatch")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive inbound WhatsApp messages
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? ""

  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[WhatsApp Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    console.error("[WhatsApp Webhook] Invalid JSON body")
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process messages in CRM (await to ensure completion before Vercel kills process)
  try {
    await processWhatsAppMessages(body)
  } catch (err) {
    console.error("[WhatsApp Webhook] Processing error:", err)
  }

  // Note: MyClaw agent receives messages directly via WhatsApp Web,
  // so no forward is needed. The CRM only records the interaction.

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// CRM Processing
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWhatsAppMessages(body: any) {
  const messages = parseWhatsAppWebhook(body)

  if (messages.length === 0) {
    return
  }

  const supabase = createAdminClient()

  for (const msg of messages) {
    try {
      const normalizedPhone = normalizePhone(msg.phone)

      // --- Deduplication: check channel_message_id ---
      const { data: existing } = await supabase
        .from("crm_interactions")
        .select("id")
        .eq("channel_message_id", msg.messageId)
        .limit(1)

      if (existing && existing.length > 0) {
        continue // Duplicate, skip
      }

      // --- Upsert contact by whatsapp_phone ---
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
        // Create new contact
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
        console.log("[WhatsApp] New contact created:", contactId)
      }

      // --- Create interaction ---
      const occurredAt = msg.timestamp
        ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString()

      const { error: interactionError } = await supabase
        .from("crm_interactions")
        .insert({
          contact_id: contactId,
          type: "whatsapp_message",
          direction: "inbound",
          subject: null,
          body: msg.message,
          channel_message_id: msg.messageId,
          channel_metadata: {
            phone: msg.phone,
            sender_name: msg.senderName ?? null,
          },
          occurred_at: occurredAt,
        })

      if (interactionError) {
        console.error("[WhatsApp] Interaction creation failed:", interactionError)
        continue
      }

      console.log("[WhatsApp] Message recorded for contact:", contactId)
    } catch (error) {
      console.error("[WhatsApp] Message processing error:", error)
    }
  }
}

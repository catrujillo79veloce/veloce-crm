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

  // Process in CRM AND forward to MyClaw agent in parallel
  // MyClaw uses Meta Cloud API via ngrok tunnel, so we must forward the payload
  const [crmResult, agentResult] = await Promise.allSettled([
    processWhatsAppMessages(body),
    forwardToAgent(rawBody),
  ])

  if (crmResult.status === "rejected") {
    console.error("[WhatsApp Webhook] CRM error:", crmResult.reason)
  }
  if (agentResult.status === "rejected") {
    console.error("[WhatsApp Webhook] Agent forward error:", agentResult.reason)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Forward to MyClaw agent (via ngrok tunnel)
// ---------------------------------------------------------------------------

async function forwardToAgent(rawBody: string) {
  const agentUrl = process.env.OPENAI_AGENT_WEBHOOK_URL
  if (!agentUrl) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

  try {
    const response = await fetch(agentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
      signal: controller.signal,
    })
    console.log("[WhatsApp] Forwarded to agent:", response.status)
  } catch (error) {
    console.error("[WhatsApp] Agent forward failed:", error)
  } finally {
    clearTimeout(timeout)
  }
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

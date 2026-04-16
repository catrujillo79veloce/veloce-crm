import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { parseInstagramWebhook, sendInstagramMessage } from "@/lib/integrations/instagram"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"

// Allow up to 60s for AI response generation + Instagram send
export const maxDuration = 60

// ---------------------------------------------------------------------------
// GET - Webhook verification
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log("[Instagram Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Instagram Webhook] Verification failed")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive Instagram messaging events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? ""

  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[Instagram Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process: save to CRM + generate AI response + send reply
  try {
    await processInstagramMessages(body)
  } catch (err) {
    console.error("[Instagram Webhook] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Main processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

async function processInstagramMessages(body: any) {
  const messages = parseInstagramWebhook(body)

  if (messages.length === 0) return

  const supabase = createAdminClient()

  for (const msg of messages) {
    try {
      // --- Deduplication ---
      const { data: existing } = await supabase
        .from("crm_interactions")
        .select("id")
        .eq("channel_message_id", msg.messageId)
        .limit(1)

      if (existing && existing.length > 0) {
        console.log("[Instagram] Duplicate message skipped:", msg.messageId)
        continue
      }

      // --- Upsert contact by instagram_id ---
      let contactId: string

      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("instagram_id", msg.senderId)
        .limit(1)

      if (existingContact && existingContact.length > 0) {
        contactId = existingContact[0].id
        await supabase
          .from("crm_contacts")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", contactId)
      } else {
        const { data: newContact, error: contactError } = await supabase
          .from("crm_contacts")
          .insert({
            first_name: "Instagram",
            last_name: `User ${msg.senderId.slice(-6)}`,
            instagram_id: msg.senderId,
            source: "instagram",
            city: "Medellin",
            status: "active",
            interests: [],
          })
          .select("id")
          .single()

        if (contactError || !newContact) {
          console.error("[Instagram] Contact creation failed:", contactError)
          continue
        }

        contactId = newContact.id
        console.log("[Instagram] New contact created:", contactId)
      }

      // --- Save inbound message ---
      await supabase.from("crm_interactions").insert({
        contact_id: contactId,
        type: "instagram_message",
        direction: "inbound",
        subject: null,
        body: msg.message,
        channel_message_id: msg.messageId,
        channel_metadata: {
          sender_id: msg.senderId,
          timestamp: msg.timestamp,
        },
        occurred_at: new Date(msg.timestamp).toISOString(),
      })

      console.log("[Instagram] Inbound saved for:", contactId)

      // --- Get conversation history for context ---
      const { data: history } = await supabase
        .from("crm_interactions")
        .select("direction, body")
        .eq("contact_id", contactId)
        .eq("type", "instagram_message")
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

      // --- Send reply via Instagram API ---
      const sent = await sendInstagramMessage(msg.senderId, aiResponse)

      if (sent) {
        await supabase.from("crm_interactions").insert({
          contact_id: contactId,
          type: "instagram_message",
          direction: "outbound",
          body: aiResponse,
          channel_metadata: { ai_generated: true, recipient_id: msg.senderId },
          occurred_at: new Date().toISOString(),
        })
        console.log("[Instagram] AI replied to:", contactId)
      } else {
        console.error("[Instagram] Failed to send reply to:", msg.senderId)
      }
    } catch (error) {
      console.error("[Instagram] Message processing error:", error)
    }
  }
}

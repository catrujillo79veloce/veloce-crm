import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { parseInstagramWebhook } from "@/lib/integrations/instagram"

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

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[Instagram Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process in background
  processInstagramMessages(body).catch((err) =>
    console.error("[Instagram Webhook] Processing error:", err)
  )

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Background processing
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
        // Create new contact - Instagram does not provide name from webhook
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

      // --- Create interaction ---
      const { error: interactionError } = await supabase
        .from("crm_interactions")
        .insert({
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

      if (interactionError) {
        console.error("[Instagram] Interaction creation failed:", interactionError)
        continue
      }

      console.log("[Instagram] Interaction created for contact:", contactId)
    } catch (error) {
      console.error("[Instagram] Message processing error:", error)
    }
  }
}

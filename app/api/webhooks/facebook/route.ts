import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { fetchLeadData, parseLeadgenWebhook, sendFacebookMessage } from "@/lib/integrations/facebook"
import { normalizePhone } from "@/lib/utils"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"

// Allow up to 60s for AI response generation + Facebook send
export const maxDuration = 60

const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"

// ---------------------------------------------------------------------------
// GET - Webhook verification
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log("[Facebook Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Facebook Webhook] Verification failed")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive Facebook Lead Ads + Messenger events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? ""

  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[Facebook Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Route based on object type
  try {
    if (body.object === "page") {
      // Messenger events come with object: "page"
      await processMessengerMessages(body)
    } else if (body.entry?.[0]?.changes?.[0]?.field === "leadgen") {
      // Lead Ads events
      await processLeadgenEvents(body)
    } else {
      // Try both - sometimes mixed
      await processMessengerMessages(body)
      await processLeadgenEvents(body)
    }
  } catch (err) {
    console.error("[Facebook Webhook] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Messenger processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

async function processMessengerMessages(body: any) {
  const entries = body?.entry ?? []
  const supabase = createAdminClient()

  for (const entry of entries) {
    const messagingEvents = entry?.messaging ?? []

    for (const event of messagingEvents) {
      try {
        // Only process incoming messages
        if (!event.message) continue
        if (event.message.is_echo) continue

        const text = event.message.text
        if (!text) continue

        const senderId: string = event.sender?.id ?? ""
        const messageId: string = event.message.mid ?? ""
        const timestamp: number = event.timestamp ?? Date.now()

        if (!senderId || !messageId) continue

        // --- Deduplication ---
        const { data: existing } = await supabase
          .from("crm_interactions")
          .select("id")
          .eq("channel_message_id", messageId)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log("[Messenger] Duplicate skipped:", messageId)
          continue
        }

        // --- Upsert contact by facebook_id ---
        let contactId: string

        const { data: existingContact } = await supabase
          .from("crm_contacts")
          .select("id")
          .eq("facebook_id", senderId)
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
              first_name: "Facebook",
              last_name: `User ${senderId.slice(-6)}`,
              facebook_id: senderId,
              source: "facebook_lead_ads",
              source_detail: "messenger",
              city: "Medellin",
              status: "active",
              interests: [],
            })
            .select("id")
            .single()

          if (contactError || !newContact) {
            console.error("[Messenger] Contact creation failed:", contactError)
            continue
          }

          contactId = newContact.id
          console.log("[Messenger] New contact:", contactId)
        }

        // --- Save inbound ---
        await supabase.from("crm_interactions").insert({
          contact_id: contactId,
          type: "facebook_message",
          direction: "inbound",
          body: text,
          channel_message_id: messageId,
          channel_metadata: { sender_id: senderId, timestamp },
          occurred_at: new Date(timestamp).toISOString(),
        })

        // --- HOT ALERT ---
        const detection = detectHotMessage(text)
        if (detection.isHot) {
          sendHotAlert({
            adminPhone: ADMIN_PHONE,
            contactName: `Facebook User ${senderId.slice(-6)}`,
            contactId,
            channel: "facebook",
            message: text,
            detection,
          }).catch((e) => console.error("[Messenger] Hot alert failed:", e))
        }

        // --- Conversation history ---
        const { data: history } = await supabase
          .from("crm_interactions")
          .select("direction, body")
          .eq("contact_id", contactId)
          .eq("type", "facebook_message")
          .order("occurred_at", { ascending: true })
          .limit(10)

        const conversationHistory = (history ?? [])
          .filter((h) => h.body)
          .map((h) => ({
            role: (h.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
            content: h.body as string,
          }))

        // --- AI response ---
        const aiResponse = await generateAgentResponse(text, conversationHistory)

        // --- Send via Messenger ---
        const sent = await sendFacebookMessage(senderId, aiResponse)

        if (sent) {
          await supabase.from("crm_interactions").insert({
            contact_id: contactId,
            type: "facebook_message",
            direction: "outbound",
            body: aiResponse,
            channel_metadata: { ai_generated: true, recipient_id: senderId },
            occurred_at: new Date().toISOString(),
          })
          console.log("[Messenger] AI replied to:", contactId)
        } else {
          console.error("[Messenger] Send failed:", senderId)
        }
      } catch (error) {
        console.error("[Messenger] Event error:", error)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lead Ads processing (unchanged)
// ---------------------------------------------------------------------------

async function processLeadgenEvents(body: any) {
  const events = parseLeadgenWebhook(body)

  if (events.length === 0) return

  const supabase = createAdminClient()

  for (const event of events) {
    try {
      const leadData = await fetchLeadData(event.leadgenId)
      if (!leadData) {
        console.error("[Facebook] Could not fetch lead data for:", event.leadgenId)
        continue
      }

      const contactInsert: Record<string, unknown> = {
        first_name: leadData.first_name || "Facebook",
        last_name: leadData.last_name || "Lead",
        source: "facebook_lead_ads",
        source_detail: `form:${event.formId}`,
        facebook_id: event.pageId,
        city: leadData.city || "Medellin",
        status: "active",
        interests: [],
      }

      if (leadData.email) {
        contactInsert.email = leadData.email.toLowerCase().trim()
      }
      if (leadData.phone) {
        contactInsert.phone = normalizePhone(leadData.phone)
        contactInsert.whatsapp_phone = normalizePhone(leadData.phone)
      }

      const { data: contact, error: contactError } = await supabase
        .from("crm_contacts")
        .insert(contactInsert)
        .select("id")
        .single()

      if (contactError || !contact) {
        console.error("[Facebook] Contact creation failed:", contactError)
        continue
      }

      const assignedTo = await getNextRoundRobinMember(supabase)

      const { data: maxPosData } = await supabase
        .from("crm_leads")
        .select("position")
        .eq("status", "new")
        .order("position", { ascending: false })
        .limit(1)

      const nextPosition =
        maxPosData && maxPosData.length > 0
          ? maxPosData[0].position + 1
          : 0

      const { error: leadError } = await supabase.from("crm_leads").insert({
        contact_id: contact.id,
        title: `Facebook Lead - ${leadData.name || leadData.email || "Sin nombre"}`,
        status: "new",
        priority: "medium",
        source: "facebook_lead_ads",
        source_detail: `form:${event.formId}`,
        assigned_to: assignedTo,
        position: nextPosition,
        score: 0,
      })

      if (leadError) {
        console.error("[Facebook] Lead creation failed:", leadError)
      }

      if (assignedTo) {
        await supabase
          .from("crm_contacts")
          .update({ assigned_to: assignedTo })
          .eq("id", contact.id)
      }

      const { error: interactionError } = await supabase
        .from("crm_interactions")
        .insert({
          contact_id: contact.id,
          type: "website_form",
          direction: "inbound",
          subject: "Facebook Lead Ad Submission",
          body: JSON.stringify({
            source: "facebook_lead_ads",
            form_id: event.formId,
            lead_data: leadData.custom_fields,
          }),
          channel_message_id: event.leadgenId,
          channel_metadata: {
            platform: "facebook",
            page_id: event.pageId,
            form_id: event.formId,
            leadgen_id: event.leadgenId,
          },
          occurred_at: event.createdTime
            ? new Date(event.createdTime * 1000).toISOString()
            : new Date().toISOString(),
        })

      if (interactionError) {
        console.error("[Facebook] Interaction creation failed:", interactionError)
      }

      console.log("[Facebook] Lead processed:", contact.id, leadData.name)
    } catch (error) {
      console.error("[Facebook] Event processing error:", error)
    }
  }
}

async function getNextRoundRobinMember(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const { data: members } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("is_active", true)

    if (!members || members.length === 0) return null

    const memberIds = members.map((m) => m.id)

    const { data: leadCounts } = await supabase
      .from("crm_leads")
      .select("assigned_to")
      .in("assigned_to", memberIds)
      .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"])

    const countMap = new Map<string, number>()
    for (const id of memberIds) {
      countMap.set(id, 0)
    }
    for (const lead of leadCounts ?? []) {
      if (lead.assigned_to) {
        countMap.set(lead.assigned_to, (countMap.get(lead.assigned_to) ?? 0) + 1)
      }
    }

    let minCount = Infinity
    let selectedId: string | null = null

    countMap.forEach((count, id) => {
      if (count < minCount) {
        minCount = count
        selectedId = id
      }
    })

    return selectedId
  } catch (error) {
    console.error("[Facebook] Round-robin assignment error:", error)
    return null
  }
}

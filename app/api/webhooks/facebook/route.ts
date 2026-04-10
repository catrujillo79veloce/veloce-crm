import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { fetchLeadData, parseLeadgenWebhook } from "@/lib/integrations/facebook"
import { normalizePhone } from "@/lib/utils"

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
// POST - Receive Facebook Lead Ads events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? ""

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.warn("[Facebook Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process in background
  processLeadgenEvents(body).catch((err) =>
    console.error("[Facebook Webhook] Processing error:", err)
  )

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Background processing
// ---------------------------------------------------------------------------

async function processLeadgenEvents(body: any) {
  const events = parseLeadgenWebhook(body)

  if (events.length === 0) return

  const supabase = createAdminClient()

  for (const event of events) {
    try {
      // Fetch full lead data from Graph API
      const leadData = await fetchLeadData(event.leadgenId)
      if (!leadData) {
        console.error("[Facebook] Could not fetch lead data for:", event.leadgenId)
        continue
      }

      // --- Create contact ---
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

      // --- Auto-assign via round-robin ---
      const assignedTo = await getNextRoundRobinMember(supabase)

      // --- Create lead ---
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

      // Update contact assignment
      if (assignedTo) {
        await supabase
          .from("crm_contacts")
          .update({ assigned_to: assignedTo })
          .eq("id", contact.id)
      }

      // --- Create interaction ---
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

// ---------------------------------------------------------------------------
// Round-robin assignment: get the active team member with fewest open leads
// ---------------------------------------------------------------------------

async function getNextRoundRobinMember(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    // Get all active team members
    const { data: members } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("is_active", true)

    if (!members || members.length === 0) return null

    // Count open leads per member
    const memberIds = members.map((m) => m.id)

    const { data: leadCounts } = await supabase
      .from("crm_leads")
      .select("assigned_to")
      .in("assigned_to", memberIds)
      .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"])

    // Build count map
    const countMap = new Map<string, number>()
    for (const id of memberIds) {
      countMap.set(id, 0)
    }
    for (const lead of leadCounts ?? []) {
      if (lead.assigned_to) {
        countMap.set(lead.assigned_to, (countMap.get(lead.assigned_to) ?? 0) + 1)
      }
    }

    // Find member with lowest count
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

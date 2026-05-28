import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  resolveAudience,
  activeWithin24h,
  type AudienceFilter,
} from "@/lib/marketing/audience"
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "@/lib/integrations/whatsapp"

// ---------------------------------------------------------------------------
// POST /api/campaigns/[id]/send
// Resolves the audience, sends, records per-recipient status and totals.
// freeform mode only sends to contacts active in the last 24h (WhatsApp rule).
// ---------------------------------------------------------------------------

export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: campaign } = await supabase
    .from("crm_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 })
  }
  if (campaign.status === "sending" || campaign.status === "sent") {
    return NextResponse.json(
      { error: "La campaña ya fue enviada o está en envío" },
      { status: 409 }
    )
  }

  const admin = createAdminClient()
  await admin.from("crm_campaigns").update({ status: "sending" }).eq("id", id)

  // Resolve audience
  const contacts = await resolveAudience(admin, campaign.audience as AudienceFilter)

  // freeform → restrict to 24h window
  let eligible = contacts
  let skipped = 0
  if (campaign.mode === "freeform") {
    const within = await activeWithin24h(
      admin,
      contacts.map((c) => c.id)
    )
    eligible = contacts.filter((c) => within.has(c.id))
    skipped = contacts.length - eligible.length
  }

  let sent = 0
  let failed = 0

  for (const c of eligible) {
    const personalized =
      campaign.mode === "freeform"
        ? (campaign.body as string).replace(/\{nombre\}/gi, c.first_name || "")
        : ""

    const result =
      campaign.mode === "template"
        ? await sendWhatsAppTemplate(
            c.whatsapp_phone,
            campaign.template_name as string,
            (campaign.template_lang as string) || "es",
            [c.first_name || ""]
          )
        : await sendWhatsAppMessage(c.whatsapp_phone, personalized)

    await admin.from("crm_campaign_recipients").upsert(
      {
        campaign_id: id,
        contact_id: c.id,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error ?? "error",
        sent_at: result.ok ? new Date().toISOString() : null,
      },
      { onConflict: "campaign_id,contact_id" }
    )

    if (result.ok) {
      sent++
      // Log as an outbound interaction
      await admin.from("crm_interactions").insert({
        contact_id: c.id,
        type: "whatsapp_message",
        direction: "outbound",
        body:
          campaign.mode === "freeform"
            ? personalized
            : `[Plantilla: ${campaign.template_name}]`,
        channel_metadata: { campaign_id: id, marketing: true },
        occurred_at: new Date().toISOString(),
      })
    } else {
      failed++
    }
  }

  await admin
    .from("crm_campaigns")
    .update({
      status: "sent",
      sent_count: sent,
      failed_count: failed,
      skipped_count: skipped,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)

  return NextResponse.json({ status: "ok", sent, failed, skipped })
}

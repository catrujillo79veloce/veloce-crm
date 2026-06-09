import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveAudience, type AudienceFilter } from "@/lib/marketing/audience"

// ---------------------------------------------------------------------------
// GET  /api/campaigns         → list campaigns
// POST /api/campaigns         → create draft (computes audience size)
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("crm_campaigns")
    .select(
      "id, name, mode, body, template_name, template_lang, status, total_recipients, sent_count, failed_count, skipped_count, sent_at, created_at, audience"
    )
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    name,
    mode = "freeform",
    text,
    template_name,
    template_lang = "es",
    audience = {},
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Falta el nombre de la campaña" }, { status: 400 })
  }
  if (mode === "freeform" && !text?.trim()) {
    return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 })
  }
  if (mode === "template" && !template_name?.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre de la plantilla aprobada" },
      { status: 400 }
    )
  }

  // Resolve audience size for display
  const admin = createAdminClient()
  const contacts = await resolveAudience(admin, audience as AudienceFilter)

  const { data, error } = await supabase
    .from("crm_campaigns")
    .insert({
      name: name.trim(),
      mode,
      body: mode === "freeform" ? text.trim() : null,
      template_name: mode === "template" ? template_name.trim() : null,
      template_lang,
      audience,
      total_recipients: contacts.length,
      created_by: user.id,
    })
    .select("id, name, mode, status, total_recipients")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}

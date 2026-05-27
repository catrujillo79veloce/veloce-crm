import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------------------
// GET  /api/settings/ai-pause  → { paused: boolean }
// POST /api/settings/ai-pause  body { paused: boolean }
//
// Global AI auto-reply kill-switch. When `paused` is true, none of the
// 3 webhooks invoke the agent — useful when Carlos is at the store
// attending in person and doesn't want bot responses going out.
// ---------------------------------------------------------------------------

async function requireTeamMember() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false as const, status: 401, error: "No autorizado" }
  }
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single()
  if (!member) {
    return { ok: false as const, status: 403, error: "Sin permisos" }
  }
  return { ok: true as const, memberId: member.id as string }
}

export async function GET() {
  const auth = await requireTeamMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from("crm_app_settings")
    .select("value")
    .eq("key", "ai_globally_paused")
    .maybeSingle()

  const paused = data?.value === true
  return NextResponse.json({ success: true, paused })
}

export async function POST(request: NextRequest) {
  const auth = await requireTeamMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const body = await request.json().catch(() => ({}))
  const paused = body?.paused
  if (typeof paused !== "boolean") {
    return NextResponse.json(
      { success: false, error: "Se requiere { paused: boolean }" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("crm_app_settings")
    .upsert(
      {
        key: "ai_globally_paused",
        value: paused,
        updated_at: new Date().toISOString(),
        updated_by: auth.memberId,
      },
      { onConflict: "key" }
    )

  if (error) {
    console.error("[AI Pause] Update failed:", error)
    return NextResponse.json(
      { success: false, error: "Error al guardar" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, paused })
}

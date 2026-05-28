import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------------------
// GET  /api/settings/signature  → { text, enabled }
// POST /api/settings/signature  { text?, enabled? }
//
// Optional signature appended to manual agent messages from the inbox.
// ---------------------------------------------------------------------------

async function requireTeamMember() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false as const, status: 401, error: "No autorizado" }
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single()
  if (!member) return { ok: false as const, status: 403, error: "Sin permisos" }
  return { ok: true as const, memberId: member.id as string }
}

export async function GET() {
  const auth = await requireTeamMember()
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from("crm_app_settings")
    .select("key, value")
    .in("key", ["manual_signature_text", "manual_signature_enabled"])
  const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]))
  return NextResponse.json({
    success: true,
    text: (map.get("manual_signature_text") as string) ?? "",
    enabled: map.get("manual_signature_enabled") === true,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireTeamMember()
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const body = await request.json().catch(() => ({}))
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const rows: { key: string; value: unknown; updated_at: string; updated_by: string }[] = []

  if (typeof body.text === "string") {
    rows.push({
      key: "manual_signature_text",
      value: body.text,
      updated_at: now,
      updated_by: auth.memberId,
    })
  }
  if (typeof body.enabled === "boolean") {
    rows.push({
      key: "manual_signature_enabled",
      value: body.enabled,
      updated_at: now,
      updated_by: auth.memberId,
    })
  }
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Nada que guardar" }, { status: 400 })
  }

  const { error } = await admin
    .from("crm_app_settings")
    .upsert(rows, { onConflict: "key" })
  if (error) {
    return NextResponse.json({ success: false, error: "Error al guardar" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

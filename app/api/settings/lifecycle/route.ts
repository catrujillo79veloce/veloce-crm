import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  SETTINGS_ENABLED_KEY,
  SETTINGS_TEMPLATE_KEYS,
} from "@/lib/lifecycle/rules"

// ---------------------------------------------------------------------------
// GET  /api/settings/lifecycle  → { enabled, templates }
// POST /api/settings/lifecycle  { enabled?, templates? }
// ---------------------------------------------------------------------------

async function requireTeamMember() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "No autorizado",
    }
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

const ALL_KEYS = [SETTINGS_ENABLED_KEY, ...Object.values(SETTINGS_TEMPLATE_KEYS)]

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
    .select("key, value")
    .in("key", ALL_KEYS)

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]))
  return NextResponse.json({
    success: true,
    enabled: map.get(SETTINGS_ENABLED_KEY) !== false, // default ON
    templates: {
      winback_90d: (map.get(SETTINGS_TEMPLATE_KEYS.winback_90d) as string) ?? "",
      overhaul_1y: (map.get(SETTINGS_TEMPLATE_KEYS.overhaul_1y) as string) ?? "",
      birthday: (map.get(SETTINGS_TEMPLATE_KEYS.birthday) as string) ?? "",
    },
  })
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
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const rows: {
    key: string
    value: unknown
    updated_at: string
    updated_by: string
  }[] = []

  if (typeof body.enabled === "boolean") {
    rows.push({
      key: SETTINGS_ENABLED_KEY,
      value: body.enabled,
      updated_at: now,
      updated_by: auth.memberId,
    })
  }
  if (body.templates && typeof body.templates === "object") {
    for (const ruleKey of ["winback_90d", "overhaul_1y", "birthday"] as const) {
      const v = body.templates[ruleKey]
      if (typeof v === "string") {
        rows.push({
          key: SETTINGS_TEMPLATE_KEYS[ruleKey],
          value: v.trim(),
          updated_at: now,
          updated_by: auth.memberId,
        })
      }
    }
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Nada que guardar" },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from("crm_app_settings")
    .upsert(rows, { onConflict: "key" })
  if (error) {
    return NextResponse.json(
      { success: false, error: "Error al guardar" },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true })
}

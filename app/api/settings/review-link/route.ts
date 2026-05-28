import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------------------
// GET  /api/settings/review-link  → { link: string, autoSend: boolean }
// POST /api/settings/review-link  body { link?: string, autoSend?: boolean }
//
// Stores the Google review link and the auto-send toggle used by the review
// request cron and the manual "Pedir reseña" buttons.
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
    .in("key", ["google_review_link", "review_auto_send"])

  const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]))
  return NextResponse.json({
    success: true,
    link: (map.get("google_review_link") as string) ?? "",
    autoSend: map.get("review_auto_send") !== false,
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

  if (typeof body.link === "string") {
    rows.push({
      key: "google_review_link",
      value: body.link.trim(),
      updated_at: now,
      updated_by: auth.memberId,
    })
  }
  if (typeof body.autoSend === "boolean") {
    rows.push({
      key: "review_auto_send",
      value: body.autoSend,
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
    console.error("[ReviewLink] Save failed:", error)
    return NextResponse.json({ success: false, error: "Error al guardar" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

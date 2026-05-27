import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// PATCH  /api/canned-responses/:id   — update (any subset of fields)
// DELETE /api/canned-responses/:id   — delete
// ---------------------------------------------------------------------------

async function requireMember() {
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
  return { ok: true as const, supabase }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (typeof body.name === "string") updates.name = body.name.trim()
  if (typeof body.body === "string") updates.body = body.body.trim()
  if (typeof body.category === "string")
    updates.category = body.category.trim() || "general"
  if (typeof body.shortcut === "string" || body.shortcut === null)
    updates.shortcut = body.shortcut ? String(body.shortcut).trim() : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "Nada que actualizar" },
      { status: 400 }
    )
  }

  const { data, error } = await auth.supabase
    .from("crm_canned_responses")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single()

  if (error) {
    console.error("[Canned] Update error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, item: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const { error } = await auth.supabase
    .from("crm_canned_responses")
    .delete()
    .eq("id", params.id)

  if (error) {
    console.error("[Canned] Delete error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

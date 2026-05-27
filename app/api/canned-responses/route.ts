import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET  /api/canned-responses        — list (optionally filter by category)
// POST /api/canned-responses        — create
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
  return { ok: true as const, supabase, memberId: member.id as string }
}

export async function GET(request: NextRequest) {
  const auth = await requireMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const category = request.nextUrl.searchParams.get("category")
  let query = auth.supabase
    .from("crm_canned_responses")
    .select("*")
    .order("use_count", { ascending: false })
    .order("name", { ascending: true })

  if (category) query = query.eq("category", category)

  const { data, error } = await query
  if (error) {
    console.error("[Canned] List error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { name, body: text, category, shortcut } = body
  if (!name?.trim() || !text?.trim()) {
    return NextResponse.json(
      { success: false, error: "Se requiere 'name' y 'body'" },
      { status: 400 }
    )
  }

  const { data, error } = await auth.supabase
    .from("crm_canned_responses")
    .insert({
      name: name.trim(),
      body: text.trim(),
      category: category?.trim() || "general",
      shortcut: shortcut?.trim() || null,
      created_by: auth.memberId,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[Canned] Create error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, item: data })
}

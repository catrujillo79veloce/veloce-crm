import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET  /api/contacts/:id/bikes  — list bikes for this contact
// POST /api/contacts/:id/bikes  — create a bike for this contact
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

export async function GET(
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
  const { data, error } = await auth.supabase
    .from("crm_customer_bikes")
    .select("*")
    .eq("contact_id", params.id)
    .order("created_at", { ascending: false })
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true, items: data ?? [] })
}

export async function POST(
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
  if (!body?.brand?.trim()) {
    return NextResponse.json(
      { success: false, error: "Se requiere marca (brand)" },
      { status: 400 }
    )
  }

  const insertable = {
    contact_id: params.id,
    brand: body.brand.trim(),
    model: body.model?.trim() || null,
    year: body.year ? Number(body.year) : null,
    color: body.color?.trim() || null,
    frame_size: body.frame_size?.trim() || null,
    serial_number: body.serial_number?.trim() || null,
    purchase_date: body.purchase_date || null,
    source: ["veloce", "external", "unknown"].includes(body.source)
      ? body.source
      : "unknown",
    notes: body.notes?.trim() || null,
    image_url: body.image_url || null,
    created_by: auth.memberId,
  }

  const { data, error } = await auth.supabase
    .from("crm_customer_bikes")
    .insert(insertable)
    .select("*")
    .single()
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true, item: data })
}

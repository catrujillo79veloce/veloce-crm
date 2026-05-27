import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// PATCH  /api/contacts/:id/bikes/:bikeId  — update bike
// DELETE /api/contacts/:id/bikes/:bikeId  — delete bike
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

const EDITABLE_FIELDS = [
  "brand",
  "model",
  "year",
  "color",
  "frame_size",
  "serial_number",
  "purchase_date",
  "source",
  "notes",
  "image_url",
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; bikeId: string } }
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
  for (const key of EDITABLE_FIELDS) {
    if (key in body) {
      const v = body[key]
      if (key === "year") {
        updates[key] = v == null || v === "" ? null : Number(v)
      } else if (typeof v === "string") {
        updates[key] = v.trim() || null
      } else {
        updates[key] = v
      }
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "Nada que actualizar" },
      { status: 400 }
    )
  }
  const { data, error } = await auth.supabase
    .from("crm_customer_bikes")
    .update(updates)
    .eq("id", params.bikeId)
    .eq("contact_id", params.id)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; bikeId: string } }
) {
  const auth = await requireMember()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }
  const { error } = await auth.supabase
    .from("crm_customer_bikes")
    .delete()
    .eq("id", params.bikeId)
    .eq("contact_id", params.id)
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true })
}

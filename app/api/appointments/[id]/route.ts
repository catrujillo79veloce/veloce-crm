import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// PATCH /api/appointments/[id] - Update status, notes, reschedule
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  // Status transitions
  if (body.status) {
    if (
      !["scheduled", "confirmed", "completed", "cancelled", "no_show"].includes(
        body.status
      )
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === "cancelled") {
      updates.cancelled_at = new Date().toISOString()
      if (body.cancelled_reason) updates.cancelled_reason = body.cancelled_reason
    }
    if (body.status === "completed") {
      updates.completed_at = new Date().toISOString()
    }
  }

  if (body.notes !== undefined) updates.notes = body.notes
  if (body.customer_notes !== undefined) updates.customer_notes = body.customer_notes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("crm_appointments")
    .update(updates)
    .eq("id", id)
    .select(
      `
      id, starts_at, ends_at, status, notes, customer_notes,
      cancelled_at, cancelled_reason, completed_at,
      service:crm_appointment_services ( id, name, color, price_cop ),
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ appointment: data })
}

// ---------------------------------------------------------------------------
// DELETE /api/appointments/[id] - Soft-delete (set status = cancelled)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("crm_appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: "Deleted by admin",
    })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// PATCH /api/reservations/[id]
// Update status, mark deposit paid, record payment method, etc.
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

  if (body.status) {
    if (
      !["pending_payment", "reserved", "completed", "cancelled", "expired"].includes(
        body.status
      )
    ) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
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

  // Mark deposit as paid → also flips status to 'reserved'
  if (body.deposit_paid === true) {
    updates.deposit_paid = true
    updates.deposit_paid_at = new Date().toISOString()
    if (!body.status) updates.status = "reserved"
    if (body.payment_method) updates.payment_method = body.payment_method
  }

  if (body.payment_method !== undefined && updates.payment_method === undefined) {
    updates.payment_method = body.payment_method
  }
  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("crm_reservations")
    .update(updates)
    .eq("id", id)
    .select(
      `
      id, reservation_number, product_name, total_price_cop, deposit_cop,
      balance_cop, status, deposit_paid, deposit_paid_at, payment_method,
      expires_at, notes, cancelled_at, completed_at,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reservation: data })
}

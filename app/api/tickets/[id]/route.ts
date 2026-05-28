import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// PATCH /api/tickets/[id] - Update status, work done, final cost, etc.
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
      !["received", "in_progress", "ready", "delivered", "cancelled"].includes(
        body.status
      )
    ) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === "ready") updates.ready_at = new Date().toISOString()
    if (body.status === "delivered") updates.delivered_at = new Date().toISOString()
    if (body.status === "cancelled") updates.cancelled_at = new Date().toISOString()
  }

  if (body.work_done !== undefined) updates.work_done = body.work_done
  if (body.problem_description !== undefined)
    updates.problem_description = body.problem_description
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.final_cost_cop !== undefined)
    updates.final_cost_cop =
      body.final_cost_cop != null ? Math.round(Number(body.final_cost_cop)) : null
  if (body.estimated_cost_cop !== undefined)
    updates.estimated_cost_cop =
      body.estimated_cost_cop != null
        ? Math.round(Number(body.estimated_cost_cop))
        : null
  if (body.estimated_ready_date !== undefined)
    updates.estimated_ready_date = body.estimated_ready_date

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("crm_service_tickets")
    .update(updates)
    .eq("id", id)
    .select(
      `
      id, ticket_number, bike_description, service_type, problem_description,
      work_done, status, estimated_cost_cop, final_cost_cop,
      estimated_ready_date, ready_at, delivered_at, notes,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ticket: data })
}

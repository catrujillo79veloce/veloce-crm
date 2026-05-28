import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/tickets - List workshop tickets
// POST /api/tickets - Create a workshop ticket
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const status = params.get("status")
  const contactId = params.get("contact_id")

  let query = supabase
    .from("crm_service_tickets")
    .select(
      `
      id, ticket_number, bike_description, service_type, problem_description,
      work_done, status, estimated_cost_cop, final_cost_cop,
      estimated_ready_date, received_at, ready_at, delivered_at, notes,
      created_by, created_at,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone, phone )
    `
    )
    .order("created_at", { ascending: false })

  if (contactId) query = query.eq("contact_id", contactId)
  if (status) {
    if (status === "active") {
      query = query.in("status", ["received", "in_progress", "ready"])
    } else if (status !== "all") {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean)
      if (statuses.length > 0) query = query.in("status", statuses)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    contact_id,
    bike_id,
    bike_description,
    service_type,
    problem_description,
    estimated_cost_cop,
    estimated_ready_date,
    notes,
    created_by = "admin",
  } = body

  if (!contact_id || !bike_description || !service_type) {
    return NextResponse.json(
      { error: "Faltan campos: contact_id, bike_description, service_type" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("crm_service_tickets")
    .insert({
      contact_id,
      bike_id: bike_id ?? null,
      bike_description,
      service_type,
      problem_description: problem_description ?? null,
      estimated_cost_cop:
        estimated_cost_cop != null ? Math.round(Number(estimated_cost_cop)) : null,
      estimated_ready_date: estimated_ready_date ?? null,
      notes: notes ?? null,
      created_by,
      created_by_user: user.id,
    })
    .select(
      `
      id, ticket_number, bike_description, service_type, status,
      estimated_cost_cop, estimated_ready_date,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ticket: data }, { status: 201 })
}

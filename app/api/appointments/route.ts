import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isSlotAvailable } from "@/lib/appointments/availability"

// ---------------------------------------------------------------------------
// GET /api/appointments - List appointments (filterable by date range, contact)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const fromParam = params.get("from")
  const toParam = params.get("to")
  const contactId = params.get("contact_id")
  const status = params.get("status") // e.g. "scheduled,confirmed"

  let query = supabase
    .from("crm_appointments")
    .select(
      `
      id, starts_at, ends_at, status, notes, customer_notes,
      created_by, created_at, updated_at,
      cancelled_at, cancelled_reason, completed_at,
      service:crm_appointment_services ( id, name, color, price_cop ),
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone, phone, instagram_id, facebook_id )
    `
    )
    .order("starts_at", { ascending: true })

  if (fromParam) query = query.gte("starts_at", fromParam)
  if (toParam) query = query.lte("starts_at", toParam)
  if (contactId) query = query.eq("contact_id", contactId)
  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean)
    if (statuses.length > 0) query = query.in("status", statuses)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ appointments: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST /api/appointments - Create new appointment
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    contact_id,
    service_id,
    starts_at,
    notes,
    customer_notes,
    created_by = "admin",
  } = body

  if (!contact_id || !service_id || !starts_at) {
    return NextResponse.json(
      { error: "Missing required fields: contact_id, service_id, starts_at" },
      { status: 400 }
    )
  }

  const startsAtDate = new Date(starts_at)
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: "Invalid starts_at" }, { status: 400 })
  }

  // Check availability
  const check = await isSlotAvailable({
    supabase,
    serviceId: service_id,
    startsAt: startsAtDate,
  })

  if (!check.available || !check.endsAt) {
    return NextResponse.json(
      { error: check.reason ?? "Slot not available" },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from("crm_appointments")
    .insert({
      contact_id,
      service_id,
      starts_at: startsAtDate.toISOString(),
      ends_at: check.endsAt.toISOString(),
      notes,
      customer_notes,
      created_by,
      created_by_user: user.id,
    })
    .select(
      `
      id, starts_at, ends_at, status, notes, customer_notes,
      service:crm_appointment_services ( id, name, color, price_cop ),
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ appointment: data }, { status: 201 })
}

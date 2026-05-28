import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/appointment-services - List available services for the form
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("crm_appointment_services")
    .select(
      "id, name, description, duration_minutes, buffer_minutes, price_cop, color, uses_fixed_slots, capacity_per_slot, is_active, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ services: data ?? [] })
}

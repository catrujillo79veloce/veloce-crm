import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getServiceAvailability } from "@/lib/appointments/availability"

// ---------------------------------------------------------------------------
// GET /api/appointments/availability?service=bike_fit_retul&days=14&from=ISO
// Returns the next N days of bookable slots for a service.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const serviceId = params.get("service")
  const daysParam = params.get("days")
  const fromParam = params.get("from")

  if (!serviceId) {
    return NextResponse.json(
      { error: "Missing required param: service" },
      { status: 400 }
    )
  }

  const daysAhead = daysParam ? Math.min(60, Math.max(1, parseInt(daysParam))) : 14
  const fromDate = fromParam ? new Date(fromParam) : new Date()

  const slots = await getServiceAvailability({
    supabase,
    serviceId,
    fromDate,
    daysAhead,
  })

  return NextResponse.json({ slots, service_id: serviceId })
}

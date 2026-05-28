import { createServerSupabaseClient } from "@/lib/supabase/server"
import AgendaClient from "@/components/agenda/AgendaClient"

export const dynamic = "force-dynamic"

interface ServiceRow {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  buffer_minutes: number
  price_cop: number | null
  color: string | null
  uses_fixed_slots: boolean
  capacity_per_slot: number
}

export default async function AgendaPage() {
  const supabase = createServerSupabaseClient()

  // Load services once on the server
  const { data: services } = await supabase
    .from("crm_appointment_services")
    .select(
      "id, name, description, duration_minutes, buffer_minutes, price_cop, color, uses_fixed_slots, capacity_per_slot"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  return <AgendaClient services={(services as ServiceRow[]) ?? []} />
}

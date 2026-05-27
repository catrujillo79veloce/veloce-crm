import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// POST /api/canned-responses/:id/use
// Increment use_count by 1 so popular templates float to the top.
// Called by the composer right when a template is inserted.
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  // Use a SQL increment so concurrent users don't race
  const { data: row } = await supabase
    .from("crm_canned_responses")
    .select("use_count")
    .eq("id", params.id)
    .single()

  if (!row) {
    return NextResponse.json(
      { success: false, error: "No existe" },
      { status: 404 }
    )
  }

  await supabase
    .from("crm_canned_responses")
    .update({ use_count: (row.use_count ?? 0) + 1 })
    .eq("id", params.id)

  return NextResponse.json({ success: true })
}

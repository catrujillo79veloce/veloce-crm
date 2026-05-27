import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/contacts/search?q=...&exclude=<id>
// Lightweight contact search used by the merge dialog (and reusable for the
// global header search later). Matches across name, email, phone, IG/FB.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const exclude = request.nextUrl.searchParams.get("exclude") ?? ""
  if (q.length < 2) {
    return NextResponse.json({ success: true, items: [] })
  }

  const pattern = `%${q}%`
  let query = supabase
    .from("crm_contacts")
    .select(
      "id, first_name, last_name, email, phone, whatsapp_phone, facebook_id, instagram_id, source, status, avatar_url, created_at"
    )
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},whatsapp_phone.ilike.${pattern},instagram_id.ilike.${pattern},facebook_id.ilike.${pattern}`
    )
    .limit(25)

  if (exclude) query = query.neq("id", exclude)

  const { data, error } = await query
  if (error) {
    console.error("[Contacts Search] Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, items: data ?? [] })
}

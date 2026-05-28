import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  resolveAudience,
  activeWithin24h,
  type AudienceFilter,
} from "@/lib/marketing/audience"

// ---------------------------------------------------------------------------
// POST /api/campaigns/preview  { audience }
// Returns total audience with WhatsApp + how many are within the 24h window
// (the freeform-eligible subset).
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const audience = (body.audience ?? {}) as AudienceFilter

  const admin = createAdminClient()
  const contacts = await resolveAudience(admin, audience)
  const within = await activeWithin24h(
    admin,
    contacts.map((c) => c.id)
  )

  return NextResponse.json({
    total: contacts.length,
    within24h: within.size,
  })
}

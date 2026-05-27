import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  pauseAIForContact,
  resumeAIForContact,
} from "@/lib/ai/should-reply"

// ---------------------------------------------------------------------------
// POST /api/contacts/:id/toggle-ai
// Body: { enabled: boolean }
//
// Manually pause or resume the AI auto-reply for a single contact.
// Used by the 🤖 toggle in the inbox conversation header.
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const { data: member } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Sin permisos" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const enabled = body?.enabled
    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Se requiere { enabled: boolean }" },
        { status: 400 }
      )
    }

    const contactId = params.id
    const admin = createAdminClient()

    if (enabled) {
      await resumeAIForContact(admin, contactId)
    } else {
      await pauseAIForContact(admin, contactId)
    }

    return NextResponse.json({ success: true, ai_enabled: enabled })
  } catch (error) {
    console.error("[Toggle AI] Unexpected:", error)
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    )
  }
}

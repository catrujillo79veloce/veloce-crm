import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// POST /api/contacts/:id/merge
// Body: { duplicateId: string }
//
// Calls the merge_crm_contacts(keeper, duplicate) Postgres function which
// atomically re-points all FK rows and deletes the duplicate.
// :id in the URL is the KEEPER — the contact that survives.
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
      .select("id, role")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Sin permisos" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const duplicateId = body?.duplicateId
    if (!duplicateId || typeof duplicateId !== "string") {
      return NextResponse.json(
        { success: false, error: "Se requiere duplicateId" },
        { status: 400 }
      )
    }
    if (duplicateId === params.id) {
      return NextResponse.json(
        { success: false, error: "No puedes fusionar un contacto consigo mismo" },
        { status: 400 }
      )
    }

    // Call the stored procedure
    const { data, error } = await supabase.rpc("merge_crm_contacts", {
      keeper_id: params.id,
      duplicate_id: duplicateId,
    })

    if (error) {
      console.error("[Merge] RPC error:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, keeper_id: data })
  } catch (e) {
    console.error("[Merge] Unexpected:", e)
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    )
  }
}

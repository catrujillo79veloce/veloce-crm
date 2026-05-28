import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendReviewRequest } from "@/lib/ai/review-request"

// ---------------------------------------------------------------------------
// POST /api/reviews/request  { contact_id }
// Manually send a Google review request to a contact (always allowed).
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const contactId = body.contact_id
  if (!contactId) {
    return NextResponse.json({ error: "Falta contact_id" }, { status: 400 })
  }

  // Use admin client so the WhatsApp send + interaction insert run with
  // service privileges (same pattern as the bot).
  const admin = createAdminClient()
  const res = await sendReviewRequest({
    supabase: admin,
    contactId,
    sourceType: "manual",
    sourceId: null,
  })

  if (!res.ok) {
    const messages: Record<string, string> = {
      no_review_link:
        "Falta configurar el link de reseñas de Google en Ajustes.",
      no_phone: "Este contacto no tiene número de WhatsApp.",
    }
    return NextResponse.json(
      { error: messages[res.reason ?? ""] ?? res.reason ?? "No se pudo enviar" },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}

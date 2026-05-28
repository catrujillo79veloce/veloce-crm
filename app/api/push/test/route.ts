import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendPush } from "@/lib/push/send"

// ---------------------------------------------------------------------------
// POST /api/push/test - send a test push to the current user's devices
// ---------------------------------------------------------------------------

export async function POST() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await sendPush(
    {
      title: "Veloce CRM 🚴",
      body: "¡Notificaciones activadas! Te avisaremos cuando llegue un mensaje.",
      url: "/inbox",
      tag: "test",
    },
    user.id
  )

  return NextResponse.json({ success: true, ...res })
}

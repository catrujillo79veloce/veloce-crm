import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// POST /api/push/subscribe   { subscription }  → save push subscription
// DELETE /api/push/subscribe { endpoint }      → remove it
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sub = body.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 })
  }

  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  const { error } = await supabase.from("crm_push_subscriptions").upsert(
    {
      member_id: member?.id ?? null,
      auth_user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: request.headers.get("user-agent") ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  )

  if (error) {
    console.error("[Push] Subscribe failed:", error)
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const endpoint = body.endpoint
  if (!endpoint) {
    return NextResponse.json({ error: "Falta endpoint" }, { status: 400 })
  }

  await supabase
    .from("crm_push_subscriptions")
    .delete()
    .eq("auth_user_id", user.id)
    .eq("endpoint", endpoint)

  return NextResponse.json({ success: true })
}

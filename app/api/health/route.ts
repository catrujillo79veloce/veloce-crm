import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { CHAT_MODEL } from "@/lib/ai/models"

export const dynamic = "force-dynamic"

// Authorize either a logged-in CRM team member (browser) or a Bearer token
// matching CRON_SECRET (programmatic/monitoring). This route runs live, paid
// API calls and reports credential status, so it must NOT be public.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth === `Bearer ${cronSecret}`) return true
  }

  try {
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: member } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()
    return !!member
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const checks: Record<string, string> = {}

  // Env var PRESENCE only — never echo any portion of a secret value.
  const vars = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FACEBOOK_PAGE_ACCESS_TOKEN",
    "FACEBOOK_APP_SECRET",
    "FACEBOOK_VERIFY_TOKEN",
    "FACEBOOK_PAGE_ID",
    "INSTAGRAM_ACCESS_TOKEN",
    "INSTAGRAM_APP_SECRET",
    "INSTAGRAM_VERIFY_TOKEN",
  ]
  for (const v of vars) {
    checks[v] = process.env[v] ? "OK" : "MISSING"
  }

  // Live Anthropic test against the SAME model production uses (so a retired
  // model id is caught here before customers hit the failure).
  checks["ANTHROPIC_MODEL"] = CHAT_MODEL
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 20,
      messages: [{ role: "user", content: "di hola" }],
    })
    checks["ANTHROPIC_TEST"] = msg.content[0]?.type === "text" ? "OK" : "OK (no text)"
  } catch (e: unknown) {
    checks["ANTHROPIC_TEST"] = `FAIL: ${e instanceof Error ? e.message : String(e)}`
  }

  // Live WhatsApp Graph reachability (status only — no raw payload echoed).
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=display_phone_number,status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    checks["WHATSAPP_TEST"] = res.ok ? "OK" : `FAIL: HTTP ${res.status}`
  } catch (e: unknown) {
    checks["WHATSAPP_TEST"] = `FAIL: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(checks)
}

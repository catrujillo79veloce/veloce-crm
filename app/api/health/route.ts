import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {}

  // Check env vars exist (don't reveal values)
  const vars = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  for (const v of vars) {
    const val = process.env[v]
    if (!val) {
      checks[v] = "MISSING"
    } else {
      checks[v] = `OK (${val.substring(0, 15)}...${val.substring(val.length - 6)})`
    }
  }

  // Test Anthropic
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 20,
      messages: [{ role: "user", content: "di hola" }],
    })
    checks["ANTHROPIC_TEST"] = `OK: ${msg.content[0].type === "text" ? msg.content[0].text : "no text"}`
  } catch (e: unknown) {
    checks["ANTHROPIC_TEST"] = `FAIL: ${e instanceof Error ? e.message : String(e)}`
  }

  // Test WhatsApp send (dry run - just check we can hit the API)
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=display_phone_number,status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    checks["WHATSAPP_TEST"] = res.ok
      ? `OK: ${JSON.stringify(data)}`
      : `FAIL: ${JSON.stringify(data)}`
  } catch (e: unknown) {
    checks["WHATSAPP_TEST"] = `FAIL: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(checks)
}

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateFollowups, buildFollowupDigest } from "@/lib/ai/followups"
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp"

// ---------------------------------------------------------------------------
// GET /api/cron/followups
//
// Daily job: (1) auto-create follow-up tasks for hot leads that went quiet,
// (2) send the admin a WhatsApp digest of follow-ups due today.
// Protected by CRON_SECRET when configured.
// ---------------------------------------------------------------------------

export const maxDuration = 60

const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  // 1. Auto-create follow-up tasks
  const result = await generateFollowups(supabase)

  // 2. Build + send the admin digest
  let digestSent = false
  const digest = await buildFollowupDigest(supabase)
  if (digest) {
    const sent = await sendWhatsAppMessage(ADMIN_PHONE, digest)
    digestSent = sent.ok
  }

  return NextResponse.json({
    status: "ok",
    created: result.created,
    skipped: result.skipped,
    digestSent,
  })
}

import { NextRequest, NextResponse } from "next/server"
import {
  getInstagramTokenStatus,
  refreshInstagramToken,
  verifyInstagramToken,
} from "@/lib/integrations/instagram-token"
import { alertAdminSystemFailure } from "@/lib/ai/notify-admin"

// ---------------------------------------------------------------------------
// GET /api/cron/refresh-ig-token
//
// Keeps the Instagram token alive so the bot never goes mute again. Instagram
// Login tokens last ~60 days; this has bitten twice (2026-07-25, 2026-10-05),
// each time silently — Meta kept delivering messages, the bot kept composing
// replies, and only the SEND failed, so nobody noticed for ~2 weeks.
//
// Runs DAILY (cheap, and every run re-verifies + can alert), but only performs
// the actual refresh when the last one is over a week old: Meta requires the
// token to be at least 24h old, and weekly extension on a 60-day life leaves a
// very wide margin.
// ---------------------------------------------------------------------------

export const maxDuration = 60

const REFRESH_AFTER_DAYS = 7
// Warn well before the cliff so there's time to regenerate by hand.
const WARN_UNDER_DAYS = 14

const MS_PER_DAY = 86_400_000

export async function GET(request: NextRequest) {
  // Fail closed: this endpoint rotates a credential — never run it unauthenticated.
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const before = await getInstagramTokenStatus()
  const ageDays = before.refreshedAt
    ? Math.floor((Date.now() - new Date(before.refreshedAt).getTime()) / MS_PER_DAY)
    : null

  // Never refreshed (just seeded) or old enough → extend it.
  const shouldRefresh = ageDays === null || ageDays >= REFRESH_AFTER_DAYS

  let refresh: Awaited<ReturnType<typeof refreshInstagramToken>> | null = null
  if (shouldRefresh) {
    refresh = await refreshInstagramToken()
    if (!refresh.ok) {
      const left =
        before.daysLeft !== null ? ` Quedan ~${before.daysLeft} dias.` : ""
      await alertAdminSystemFailure(
        "Token de Instagram: fallo la renovacion",
        `No se pudo renovar automaticamente: ${refresh.error}.${left} Si ya vencio hay que generar uno nuevo a mano: Meta -> app Veloce Agent -> Instagram -> API Setup -> Generar token.`
      )
    } else {
      console.log(
        `[CronIGToken] Token renovado, ~${refresh.daysLeft} dias de vida`
      )
    }
  }

  // Always confirm the live token is actually accepted. A refresh that
  // "succeeded" but left a dead token is precisely the silent failure mode
  // this job exists to catch.
  const verify = await verifyInstagramToken()
  if (!verify.ok) {
    await alertAdminSystemFailure(
      "Token de Instagram invalido - el bot NO responde DMs",
      `Instagram rechaza el token (${verify.error}). Genera uno nuevo: Meta -> app Veloce Agent -> Instagram -> API Setup -> seccion 1 -> Generar token.`
    )
  }

  const after = await getInstagramTokenStatus()
  if (
    verify.ok &&
    after.daysLeft !== null &&
    after.daysLeft < WARN_UNDER_DAYS
  ) {
    await alertAdminSystemFailure(
      "Token de Instagram por vencer",
      `Quedan ${after.daysLeft} dias y la renovacion automatica no lo esta extendiendo. Revisalo antes de que el bot deje de responder.`
    )
  }

  return NextResponse.json({
    status: "ok",
    attemptedRefresh: shouldRefresh,
    refresh,
    tokenValid: verify.ok,
    username: verify.username ?? null,
    expiresAt: after.expiresAt,
    daysLeft: after.daysLeft,
  })
}

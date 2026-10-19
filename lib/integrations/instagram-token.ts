// ---------------------------------------------------------------------------
// Instagram access token: runtime storage + auto-refresh.
//
// WHY THIS EXISTS. Instagram Login (IGAA) long-lived tokens expire after ~60
// days. It has silently expired twice (2026-07-25 and 2026-10-05) and because
// the token lived only in a Vercel env var, the app could never renew itself —
// a redeploy by a human was the only cure. Worse, the failure is quiet: Meta
// keeps delivering webhooks, the bot still composes a reply, and only the SEND
// fails (code 190), so customers go unanswered. The last outage ran 14 days and
// left 28 Instagram messages — including a price request — with no answer.
//
// Meta lets a STILL-VALID long-lived token be extended another ~60 days via
// `refresh_access_token`. So the token now lives in crm_app_settings (which the
// app can write at runtime) and a cron refreshes it on a schedule. The env var
// stays as a bootstrap/fallback so nothing breaks before the row is seeded.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin"

export const IG_TOKEN_KEY = "instagram_access_token"
export const IG_TOKEN_EXPIRES_KEY = "instagram_token_expires_at"
export const IG_TOKEN_REFRESHED_KEY = "instagram_token_refreshed_at"

type AdminClient = ReturnType<typeof createAdminClient>

// A burst of inbound messages shouldn't cost a DB round-trip per send.
let cache: { token: string; at: number } | null = null
const CACHE_MS = 60_000

async function readSetting(
  supabase: AdminClient,
  key: string
): Promise<unknown> {
  const { data, error } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle()
  if (error) {
    console.error(`[IGToken] Error leyendo ${key}:`, error)
    return null
  }
  return data?.value ?? null
}

async function writeSetting(
  supabase: AdminClient,
  key: string,
  value: unknown
): Promise<void> {
  const { error } = await supabase
    .from("crm_app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
  if (error) {
    throw new Error(`No se pudo guardar ${key}: ${error.message}`)
  }
}

/**
 * The Instagram access token in effect: the stored one if present, otherwise
 * the env var (bootstrap, or if the DB is briefly unreachable).
 */
export async function getInstagramToken(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.token

  try {
    const stored = await readSetting(createAdminClient(), IG_TOKEN_KEY)
    if (typeof stored === "string" && stored.length > 20) {
      cache = { token: stored, at: Date.now() }
      return stored
    }
  } catch (e) {
    console.error("[IGToken] Lectura fallida, uso el env var:", e)
  }

  const fromEnv = process.env.INSTAGRAM_ACCESS_TOKEN
  return fromEnv && fromEnv.length > 20 ? fromEnv : null
}

/** Persist a token plus its expiry, and refresh the in-process cache. */
export async function storeInstagramToken(
  token: string,
  expiresInSeconds: number
): Promise<void> {
  const supabase = createAdminClient()
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  await writeSetting(supabase, IG_TOKEN_KEY, token)
  await writeSetting(supabase, IG_TOKEN_EXPIRES_KEY, expiresAt)
  await writeSetting(supabase, IG_TOKEN_REFRESHED_KEY, new Date().toISOString())
  cache = { token, at: Date.now() }
}

export interface TokenStatus {
  expiresAt: string | null
  refreshedAt: string | null
  /** Whole days until expiry; null when we've never recorded an expiry. */
  daysLeft: number | null
}

export async function getInstagramTokenStatus(): Promise<TokenStatus> {
  const supabase = createAdminClient()
  const expiresAt = (await readSetting(
    supabase,
    IG_TOKEN_EXPIRES_KEY
  )) as string | null
  const refreshedAt = (await readSetting(
    supabase,
    IG_TOKEN_REFRESHED_KEY
  )) as string | null

  const daysLeft = expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null

  return { expiresAt, refreshedAt, daysLeft }
}

/** Is the live token actually accepted by Meta right now? */
export async function verifyInstagramToken(): Promise<{
  ok: boolean
  username?: string
  error?: string
}> {
  const token = await getInstagramToken()
  if (!token) return { ok: false, error: "No hay token configurado" }
  try {
    const res = await fetch(
      `https://graph.instagram.com/v22.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`
    )
    const raw = await res.text()
    if (!res.ok) return { ok: false, error: raw.slice(0, 200) }
    const data = JSON.parse(raw) as { username?: string }
    return { ok: true, username: data.username }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface RefreshOutcome {
  ok: boolean
  error?: string
  /** Days of life the refreshed token has. */
  daysLeft?: number | null
}

/**
 * Extend the long-lived token by another ~60 days.
 *
 * Meta requires the token to still be VALID and at least 24h old, so this is
 * only useful on a periodic schedule — an already-expired token cannot be
 * refreshed and has to be regenerated by hand in the Meta dashboard.
 */
export async function refreshInstagramToken(): Promise<RefreshOutcome> {
  const token = await getInstagramToken()
  if (!token) return { ok: false, error: "No hay token de Instagram configurado" }

  try {
    const url =
      `https://graph.instagram.com/refresh_access_token` +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url)
    const raw = await res.text()

    if (!res.ok) {
      return { ok: false, error: `Meta respondio ${res.status}: ${raw.slice(0, 200)}` }
    }

    const data = JSON.parse(raw) as { access_token?: string; expires_in?: number }
    if (!data.access_token || !data.expires_in) {
      return { ok: false, error: "Respuesta inesperada de Meta al renovar el token" }
    }

    await storeInstagramToken(data.access_token, data.expires_in)
    return { ok: true, daysLeft: Math.floor(data.expires_in / 86_400) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

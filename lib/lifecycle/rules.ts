// ---------------------------------------------------------------------------
// Lifecycle automation rules.
//
// Each rule queries the database for contacts that should be re-engaged
// today and have NOT already been touched within the rule's cooldown
// window. The candidate lookups live as SQL functions in Postgres (see
// migration `crm_lifecycle_candidate_functions`) so we can do CTEs &
// EXISTS subqueries efficiently without round-tripping through JS.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export type LifecycleRuleKey = "winback_90d" | "overhaul_1y" | "birthday"

export interface LifecycleCandidate {
  id: string
  first_name: string
  whatsapp_phone: string
  /** Rule-specific extras for UI / logging. */
  meta?: Record<string, string | null>
}

/**
 * Contacts that haven't interacted in ≥90 days, were customers at some point,
 * and weren't touched by the winback rule in the last 180 days.
 */
export async function findWinbackCandidates(
  supabase: AdminClient,
  options: {
    quietDays?: number
    cooldownDays?: number
    cutoffDays?: number
    maxResults?: number
  } = {}
): Promise<LifecycleCandidate[]> {
  const { data, error } = await supabase.rpc("crm_winback_candidates", {
    quiet_days: options.quietDays ?? 90,
    cooldown_days: options.cooldownDays ?? 180,
    cutoff_days: options.cutoffDays ?? 730,
    max_results: options.maxResults ?? 100,
  })
  if (error) {
    console.error("[Lifecycle] winback rpc error:", error)
    return []
  }
  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      first_name: r.first_name,
      whatsapp_phone: r.whatsapp_phone,
      meta: { last_seen_at: r.last_seen_at ?? null },
    })
  )
}

/**
 * Contacts whose bike (bought at Veloce) is ~12 months old and haven't been
 * sent an overhaul reminder in the last 365 days.
 */
export async function findOverhaulCandidates(
  supabase: AdminClient,
  options: { cooldownDays?: number; maxResults?: number } = {}
): Promise<LifecycleCandidate[]> {
  const { data, error } = await supabase.rpc("crm_overhaul_candidates", {
    cooldown_days: options.cooldownDays ?? 365,
    max_results: options.maxResults ?? 100,
  })
  if (error) {
    console.error("[Lifecycle] overhaul rpc error:", error)
    return []
  }
  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      first_name: r.first_name,
      whatsapp_phone: r.whatsapp_phone,
      meta: {
        bike_brand: r.bike_brand ?? null,
        bike_model: r.bike_model ?? null,
      },
    })
  )
}

/**
 * Contacts with date_of_birth matching today's MM-DD (and not sent a
 * birthday greeting in the last 360 days).
 */
export async function findBirthdayCandidates(
  supabase: AdminClient,
  options: { cooldownDays?: number; maxResults?: number } = {}
): Promise<LifecycleCandidate[]> {
  const { data, error } = await supabase.rpc("crm_birthday_candidates", {
    cooldown_days: options.cooldownDays ?? 360,
    max_results: options.maxResults ?? 50,
  })
  if (error) {
    console.error("[Lifecycle] birthday rpc error:", error)
    return []
  }
  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      first_name: r.first_name,
      whatsapp_phone: r.whatsapp_phone,
    })
  )
}

// ---------------------------------------------------------------------------
// Default messages (used when no Meta-approved template is configured).
// Only delivered to contacts active in the last 24h (WhatsApp policy).
// ---------------------------------------------------------------------------

export const DEFAULT_BODIES: Record<LifecycleRuleKey, string> = {
  winback_90d:
    "Hola {nombre} 👋 hace tiempo no sabemos de ti en Veloce. ¿Cómo va tu bici? Te invitamos a pasar por una revisión gratuita y a ver lo nuevo en tienda. Calle 16A Sur # 32B-38, Local 101, El Poblado 🚲",
  overhaul_1y:
    "Hola {nombre}, hace casi un año compraste tu bici en Veloce. Es un buen momento para un overhaul completo: limpieza profunda, ajustes y revisión de transmisión. ¿Te agendamos? 🔧🚲",
  birthday:
    "🎂 ¡Feliz cumpleaños {nombre}! De parte del equipo Veloce, te queremos regalar 10 % en accesorios cuando vengas a tienda y un café para ti. ¡Que la pases bonito sobre la bici! 🚴",
}

export const RULE_LABELS: Record<LifecycleRuleKey, string> = {
  winback_90d: "Winback 90 días",
  overhaul_1y: "Overhaul anual",
  birthday: "Cumpleaños",
}

export const SETTINGS_TEMPLATE_KEYS: Record<LifecycleRuleKey, string> = {
  winback_90d: "lifecycle_template_winback",
  overhaul_1y: "lifecycle_template_overhaul",
  birthday: "lifecycle_template_birthday",
}

export const SETTINGS_ENABLED_KEY = "lifecycle_enabled"

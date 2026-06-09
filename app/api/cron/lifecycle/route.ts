import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  findBirthdayCandidates,
  findOverhaulCandidates,
  findWinbackCandidates,
  DEFAULT_BODIES,
  RULE_LABELS,
  SETTINGS_ENABLED_KEY,
  SETTINGS_TEMPLATE_KEYS,
  type LifecycleCandidate,
  type LifecycleRuleKey,
} from "@/lib/lifecycle/rules"

// ---------------------------------------------------------------------------
// GET /api/cron/lifecycle
//
// Daily job — for each lifecycle rule, finds today's candidates and creates
// a DRAFT campaign in /marketing for the admin to review and send.
//
// Template-mode draft if a Meta-approved template name is configured in
// settings; freeform draft otherwise (only reaches contacts active in the
// last 24h, per WhatsApp policy).
//
// Touched contacts are logged in crm_lifecycle_log so they aren't re-targeted
// within the rule's cooldown window.
//
// Protected by CRON_SECRET when configured.
// ---------------------------------------------------------------------------

export const maxDuration = 60

type AdminClient = ReturnType<typeof createAdminClient>

const RULES: LifecycleRuleKey[] = ["winback_90d", "overhaul_1y", "birthday"]

interface RuleResult {
  rule: LifecycleRuleKey
  candidates: number
  campaign_id: string | null
  mode: "template" | "freeform" | null
  skipped_reason?: string
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()

  // Master kill-switch — defaults to ENABLED if no row exists yet.
  const enabled = await getBoolSetting(supabase, SETTINGS_ENABLED_KEY, true)
  if (!enabled) {
    return NextResponse.json({ status: "ok", enabled: false, results: [] })
  }

  const creatorId = await findCreatorAuthUserId(supabase)

  // Load all 3 template-name settings up front
  const templateNames = await getStringSettings(
    supabase,
    Object.values(SETTINGS_TEMPLATE_KEYS)
  )

  const results: RuleResult[] = []

  for (const rule of RULES) {
    const candidates = await findCandidates(supabase, rule)

    if (candidates.length === 0) {
      results.push({
        rule,
        candidates: 0,
        campaign_id: null,
        mode: null,
        skipped_reason: "no candidates",
      })
      continue
    }

    const templateName =
      templateNames[SETTINGS_TEMPLATE_KEYS[rule]]?.trim() || null
    const mode: "template" | "freeform" = templateName ? "template" : "freeform"

    const campaignId = await createDraftCampaign(supabase, {
      rule,
      candidates,
      mode,
      templateName,
      creatorId,
    })

    if (!campaignId) {
      results.push({
        rule,
        candidates: candidates.length,
        campaign_id: null,
        mode,
        skipped_reason: "campaign insert failed",
      })
      continue
    }

    await supabase.from("crm_lifecycle_log").insert(
      candidates.map((c) => ({
        contact_id: c.id,
        rule_key: rule,
        campaign_id: campaignId,
      }))
    )

    results.push({
      rule,
      candidates: candidates.length,
      campaign_id: campaignId,
      mode,
    })
  }

  return NextResponse.json({ status: "ok", enabled: true, results })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findCandidates(
  supabase: AdminClient,
  rule: LifecycleRuleKey
): Promise<LifecycleCandidate[]> {
  switch (rule) {
    case "winback_90d":
      return findWinbackCandidates(supabase)
    case "overhaul_1y":
      return findOverhaulCandidates(supabase)
    case "birthday":
      return findBirthdayCandidates(supabase)
  }
}

async function createDraftCampaign(
  supabase: AdminClient,
  args: {
    rule: LifecycleRuleKey
    candidates: LifecycleCandidate[]
    mode: "template" | "freeform"
    templateName: string | null
    creatorId: string | null
  }
): Promise<string | null> {
  const { rule, candidates, mode, templateName, creatorId } = args

  const today = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  })

  const insert: Record<string, unknown> = {
    name: `Auto · ${RULE_LABELS[rule]} (${today})`,
    mode,
    body: mode === "freeform" ? DEFAULT_BODIES[rule] : null,
    template_name: mode === "template" ? templateName : null,
    template_lang: "es",
    audience: {
      contact_ids: candidates.map((c) => c.id),
      lifecycle_rule: rule,
    },
    total_recipients: candidates.length,
  }
  if (creatorId) insert.created_by = creatorId

  const { data, error } = await supabase
    .from("crm_campaigns")
    .insert(insert)
    .select("id")
    .single()

  if (error) {
    console.error(`[Lifecycle] insert campaign error for ${rule}:`, error)
    return null
  }
  return data.id as string
}

async function findCreatorAuthUserId(
  supabase: AdminClient
): Promise<string | null> {
  // The admin "owns" auto-generated drafts. Pick the first active admin.
  const { data } = await supabase
    .from("crm_team_members")
    .select("auth_user_id")
    .eq("role", "admin")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.auth_user_id as string | undefined) ?? null
}

async function getBoolSetting(
  supabase: AdminClient,
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  const { data } = await supabase
    .from("crm_app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle()
  if (!data) return defaultValue
  return data.value === true
}

async function getStringSettings(
  supabase: AdminClient,
  keys: string[]
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("crm_app_settings")
    .select("key, value")
    .in("key", keys)
  const out: Record<string, string> = {}
  for (const row of data ?? []) {
    if (typeof row.value === "string") {
      out[row.key as string] = row.value as string
    }
  }
  return out
}

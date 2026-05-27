// ---------------------------------------------------------------------------
// Apply an AI-classified intent as a tag on the contact.
//
// Idempotent: if the tag is already on the contact, no-op. Only writes when
// confidence is high enough (default >= 0.6) to avoid noise from saludos and
// short messages classified with uncertainty.
// ---------------------------------------------------------------------------

import type { createAdminClient } from "@/lib/supabase/admin"
import type { IntentTag } from "./classify-intent"

const MIN_CONFIDENCE = 0.6

export async function applyIntentTag(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string,
  intent: IntentTag,
  confidence: number
): Promise<void> {
  if (confidence < MIN_CONFIDENCE) {
    console.log(
      `[IntentTag] Low confidence (${confidence.toFixed(2)}) for ${intent} on ${contactId} — skipping`
    )
    return
  }

  // Look up the tag id by canonical name (seeded by migration)
  const { data: tagRow } = await supabase
    .from("crm_tags")
    .select("id")
    .eq("name", intent)
    .maybeSingle()

  if (!tagRow) {
    console.warn(`[IntentTag] Tag '${intent}' not found in crm_tags`)
    return
  }

  // Insert; if it already exists (composite PK), ignore silently
  const { error } = await supabase
    .from("crm_contact_tags")
    .insert({
      contact_id: contactId,
      tag_id: tagRow.id,
      source: "ai",
    })

  if (error && error.code !== "23505") {
    // 23505 = unique_violation — tag already applied
    console.error("[IntentTag] Insert failed:", error)
  } else if (!error) {
    console.log(
      `[IntentTag] Applied '${intent}' (${confidence.toFixed(2)}) to ${contactId}`
    )
  }
}

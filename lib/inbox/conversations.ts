// ---------------------------------------------------------------------------
// Inbox conversation query — shared by the /inbox page (SSR) and the
// refreshConversations server action (used to re-sync the client after a
// realtime disconnect, tab focus or network recovery).
//
// Keeping a single source of truth here means the live list can never drift
// from what a full page load would render.
//
// Server-only: this module imports the cookie-backed Supabase client. Client
// components take the types and the unread rule from ./shared instead.
// ---------------------------------------------------------------------------

import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  INBOX_MESSAGE_TYPES,
  isUnread,
  type ConversationSummary,
} from "@/lib/inbox/shared"
import type { Contact, Interaction } from "@/lib/types"

export type { ConversationSummary }
export { INBOX_MESSAGE_TYPES, isUnread }

const CONTACT_FIELDS = `
  id, first_name, last_name, email, phone, whatsapp_phone,
  facebook_id, instagram_id, source, avatar_url, status,
  ai_enabled, ai_paused_at, assigned_to, inbox_read_at
`

/**
 * Most recent messaging interaction per contact, newest conversation first.
 *
 * `limit` caps how many raw interactions we scan. 200 rows only covered a few
 * days of traffic, so older conversations silently vanished from the inbox;
 * 2000 covers months at current volume while staying a single cheap query.
 */
export async function getConversations(
  limit = 2000
): Promise<ConversationSummary[]> {
  const supabase = createServerSupabaseClient()

  const { data: interactions, error } = await supabase
    .from("crm_interactions")
    .select(
      `
      *,
      contact:crm_contacts!crm_interactions_contact_id_fkey(${CONTACT_FIELDS})
    `
    )
    .in("type", INBOX_MESSAGE_TYPES as unknown as string[])
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[Inbox] getConversations error:", error)
    return []
  }

  // Group by contact, keeping only the most recent interaction per contact.
  const contactMap = new Map<string, ConversationSummary>()

  for (const row of interactions ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contact = (row as any).contact as Contact | null
    if (!contact) continue

    if (!contactMap.has(contact.id)) {
      contactMap.set(contact.id, {
        contact,
        lastInteraction: {
          ...row,
          contact: undefined,
        } as unknown as Interaction,
        unreadCount: 0,
      })
    }

    const summary = contactMap.get(contact.id)!
    if (isUnread(row as unknown as Interaction, contact.inbox_read_at)) {
      summary.unreadCount++
    }
  }

  return Array.from(contactMap.values()).sort(
    (a, b) =>
      new Date(b.lastInteraction.occurred_at).getTime() -
      new Date(a.lastInteraction.occurred_at).getTime()
  )
}

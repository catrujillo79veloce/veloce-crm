"use server"

// ---------------------------------------------------------------------------
// Inbox server actions used by the live client:
//   - refreshConversations(): authoritative re-sync after a realtime gap
//   - getUnreadCount():       badge value for the sidebar / mobile nav
//   - markConversationRead(): stamps inbox_read_at when a human opens a chat
// ---------------------------------------------------------------------------

import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  getConversations,
  INBOX_MESSAGE_TYPES,
  type ConversationSummary,
} from "@/lib/inbox/conversations"

export async function refreshConversations(): Promise<ConversationSummary[]> {
  return getConversations()
}

/**
 * Number of conversations with at least one inbound message nobody has opened
 * yet. Counts conversations, not messages — the badge answers "how many people
 * are waiting on me", which is what drives action.
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_interactions")
    .select(
      `contact_id, occurred_at,
       contact:crm_contacts!crm_interactions_contact_id_fkey(inbox_read_at)`
    )
    .eq("direction", "inbound")
    .in("type", INBOX_MESSAGE_TYPES as unknown as string[])
    .order("occurred_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[Inbox] getUnreadCount error:", error)
    return 0
  }

  const pending = new Set<string>()
  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readAt = (row as any).contact?.inbox_read_at as string | null | undefined
    if (!readAt || new Date(row.occurred_at).getTime() > new Date(readAt).getTime()) {
      pending.add(row.contact_id as string)
    }
  }
  return pending.size
}

export async function markConversationRead(
  contactId: string
): Promise<{ success: boolean }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_contacts")
    .update({ inbox_read_at: new Date().toISOString() })
    .eq("id", contactId)

  if (error) {
    console.error("[Inbox] markConversationRead error:", error)
    return { success: false }
  }
  return { success: true }
}

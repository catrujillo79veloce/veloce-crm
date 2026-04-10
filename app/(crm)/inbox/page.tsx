import { createServerSupabaseClient } from "@/lib/supabase/server"
import InboxView from "@/components/inbox/InboxView"
import type { Contact, Interaction } from "@/lib/types"

export interface ConversationSummary {
  contact: Contact
  lastInteraction: Interaction
  unreadCount: number
}

async function getConversations(): Promise<ConversationSummary[]> {
  const supabase = createServerSupabaseClient()

  // Get the latest messaging interaction per contact
  // We filter to message-type interactions (WhatsApp, Facebook, Instagram)
  const { data: interactions, error } = await supabase
    .from("crm_interactions")
    .select(
      `
      *,
      contact:crm_contacts!crm_interactions_contact_id_fkey(
        id, first_name, last_name, email, phone, whatsapp_phone,
        facebook_id, instagram_id, source, avatar_url, status
      )
    `
    )
    .in("type", [
      "whatsapp_message",
      "facebook_message",
      "instagram_message",
    ])
    .order("occurred_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("Inbox getConversations error:", error)
    return []
  }

  // Group by contact, keeping only the most recent interaction per contact
  const contactMap = new Map<string, ConversationSummary>()

  for (const row of interactions ?? []) {
    const contact = (row as any).contact as Contact | null
    if (!contact) continue

    if (!contactMap.has(contact.id)) {
      contactMap.set(contact.id, {
        contact,
        lastInteraction: {
          ...row,
          contact: undefined,
        } as unknown as Interaction,
        // Unread: count inbound messages that have no team_member_id (not replied)
        unreadCount: row.direction === "inbound" && !row.team_member_id ? 1 : 0,
      })
    } else {
      // Already have this contact, just increment unread if applicable
      const existing = contactMap.get(contact.id)!
      if (row.direction === "inbound" && !row.team_member_id) {
        existing.unreadCount++
      }
    }
  }

  // Sort by most recent interaction
  const conversations = Array.from(contactMap.values())
  conversations.sort(
    (a, b) =>
      new Date(b.lastInteraction.occurred_at).getTime() -
      new Date(a.lastInteraction.occurred_at).getTime()
  )

  return conversations
}

export default async function InboxPage() {
  const conversations = await getConversations()

  return <InboxView initialConversations={conversations} />
}

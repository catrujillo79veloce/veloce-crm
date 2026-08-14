// ---------------------------------------------------------------------------
// Inbox types and rules shared by the server query and the client components.
//
// Deliberately free of server-only imports: the client bundles `isUnread` so
// that a row arriving over realtime is classified with exactly the same rule
// the server used, without a round-trip.
// ---------------------------------------------------------------------------

import type { Contact, Interaction } from "@/lib/types"

export interface ConversationSummary {
  contact: Contact
  lastInteraction: Interaction
  unreadCount: number
}

// Message-type interactions that belong in the inbox (notes are excluded —
// they live inside the thread, not the conversation list).
export const INBOX_MESSAGE_TYPES = [
  "whatsapp_message",
  "facebook_message",
  "instagram_message",
] as const

/**
 * An inbound message counts as unread until a human opens the conversation.
 *
 * Note this is not "until someone replies": the AI bot answers nearly every
 * message, so a reply-based rule left the badge permanently at zero while real
 * customers sat unattended.
 */
export function isUnread(
  interaction: Pick<Interaction, "direction" | "occurred_at">,
  inboxReadAt: string | null | undefined
): boolean {
  if (interaction.direction !== "inbound") return false
  if (!inboxReadAt) return true
  return (
    new Date(interaction.occurred_at).getTime() >
    new Date(inboxReadAt).getTime()
  )
}

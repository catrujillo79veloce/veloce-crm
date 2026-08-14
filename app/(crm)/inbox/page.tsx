import { createServerSupabaseClient } from "@/lib/supabase/server"
import InboxView from "@/components/inbox/InboxView"
import { getConversations } from "@/lib/inbox/conversations"
import type { MentionablePerson } from "@/components/inbox/MentionPicker"

export type { ConversationSummary } from "@/lib/inbox/conversations"

// The inbox must always render the current state of the world, never a cached
// snapshot from a previous request.
export const dynamic = "force-dynamic"

async function getActiveTeamMembers(): Promise<MentionablePerson[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("crm_team_members")
    .select("id, full_name, avatar_url")
    .eq("is_active", true)
    .order("full_name")

  if (error) {
    console.error("Inbox getActiveTeamMembers error:", error)
    return []
  }
  return (data ?? []) as MentionablePerson[]
}

export default async function InboxPage() {
  const [conversations, teamMembers] = await Promise.all([
    getConversations(),
    getActiveTeamMembers(),
  ])

  return (
    <InboxView
      initialConversations={conversations}
      teamMembers={teamMembers}
    />
  )
}

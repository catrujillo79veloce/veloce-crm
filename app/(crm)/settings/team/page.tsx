import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TeamMember } from "@/lib/types"
import TeamManager from "./TeamManager"

async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("crm_team_members")
    .select("*")
    .order("full_name")

  if (error) {
    console.error("Error fetching team members:", error)
    return []
  }

  return (data as TeamMember[]) || []
}

export default async function TeamSettingsPage() {
  const members = await getTeamMembers()
  return <TeamManager initialMembers={members} />
}

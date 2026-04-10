"use server"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TeamMember } from "@/lib/types"

export async function getCurrentTeamMember(): Promise<TeamMember | null> {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: member } = await supabase
    .from("crm_team_members")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  return (member as TeamMember) ?? null
}

export async function signOut(): Promise<void> {
  const supabase = createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect("/login")
}

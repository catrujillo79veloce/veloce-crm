"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Lead, LeadStatus, Priority, ContactSource } from "@/lib/types"

export interface LeadsByStatus {
  [status: string]: Lead[]
}

export async function getLeads(): Promise<LeadsByStatus> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_leads")
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url),
      assigned_member:crm_team_members!crm_leads_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .order("position", { ascending: true })

  if (error) {
    console.error("Error fetching leads:", error)
    return {}
  }

  const grouped: LeadsByStatus = {}
  const statuses: LeadStatus[] = [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ]

  for (const status of statuses) {
    grouped[status] = []
  }

  for (const lead of data || []) {
    const status = lead.status as LeadStatus
    if (!grouped[status]) {
      grouped[status] = []
    }
    grouped[status].push(lead as Lead)
  }

  return grouped
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_leads")
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url, city, source, cycling_experience),
      assigned_member:crm_team_members!crm_leads_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching lead:", error)
    return null
  }

  return data as Lead
}

export interface CreateLeadInput {
  contact_id: string
  title: string
  priority: Priority
  estimated_value: number | null
  source?: ContactSource | null
  assigned_to?: string | null
  expected_close_date?: string | null
}

export async function createLead(input: CreateLeadInput): Promise<{ data: Lead | null; error: string | null }> {
  const supabase = createServerSupabaseClient()

  // Get the max position in "new" column
  const { data: maxPosData } = await supabase
    .from("crm_leads")
    .select("position")
    .eq("status", "new")
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = maxPosData && maxPosData.length > 0 ? maxPosData[0].position + 1 : 0

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      ...input,
      status: "new" as LeadStatus,
      position: nextPosition,
      score: 0,
    })
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url),
      assigned_member:crm_team_members!crm_leads_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error creating lead:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/leads")
  return { data: data as Lead, error: null }
}

export interface UpdateLeadInput {
  title?: string
  priority?: Priority
  estimated_value?: number | null
  assigned_to?: string | null
  source?: ContactSource | null
  expected_close_date?: string | null
  lost_reason?: string | null
  score?: number
}

export async function updateLead(
  id: string,
  input: UpdateLeadInput
): Promise<{ data: Lead | null; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_leads")
    .update(input)
    .eq("id", id)
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url),
      assigned_member:crm_team_members!crm_leads_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error updating lead:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/leads")
  return { data: data as Lead, error: null }
}

export async function updateLeadStatus(
  id: string,
  newStatus: LeadStatus,
  newPosition: number
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServerSupabaseClient()

  // Attempt to shift positions in the target column to make room
  // If the RPC doesn't exist, this is a no-op and positions are best-effort
  try {
    await supabase.rpc("shift_lead_positions", {
      p_status: newStatus,
      p_position: newPosition,
    })
  } catch {
    // RPC may not exist - positions are best-effort
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    position: newPosition,
  }

  // Auto-set closed_at when moving to won/lost
  if (newStatus === "won" || newStatus === "lost") {
    updateData.closed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("crm_leads")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("Error updating lead status:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/leads")
  return { success: true, error: null }
}

export async function deleteLead(id: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("crm_leads").delete().eq("id", id)

  if (error) {
    console.error("Error deleting lead:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/leads")
  return { success: true, error: null }
}

export async function getTeamMembers() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_team_members")
    .select("id, full_name, email, avatar_url")
    .eq("is_active", true)
    .order("full_name")

  if (error) {
    console.error("Error fetching team members:", error)
    return []
  }

  return data || []
}

export async function getContacts() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, phone, avatar_url")
    .eq("status", "active")
    .order("first_name")

  if (error) {
    console.error("Error fetching contacts:", error)
    return []
  }

  return data || []
}

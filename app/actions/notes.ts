"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Note } from "@/lib/types"

export async function getNotes(params: {
  contact_id?: string
  deal_id?: string
  lead_id?: string
}): Promise<Note[]> {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from("crm_notes")
    .select(
      `
      *,
      creator:crm_team_members!crm_notes_created_by_fkey(id, full_name, avatar_url)
    `
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (params.contact_id) {
    query = query.eq("contact_id", params.contact_id)
  }

  if (params.deal_id) {
    query = query.eq("deal_id", params.deal_id)
  }

  if (params.lead_id) {
    query = query.eq("lead_id", params.lead_id)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching notes:", error)
    return []
  }

  return (data as Note[]) || []
}

export async function createNote(formData: {
  body: string
  contact_id?: string | null
  deal_id?: string | null
  lead_id?: string | null
  is_pinned?: boolean
}): Promise<{ success: boolean; error?: string; note?: Note }> {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Get team member id
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!member) {
    return { success: false, error: "Team member not found" }
  }

  const { data, error } = await supabase
    .from("crm_notes")
    .insert({
      body: formData.body,
      contact_id: formData.contact_id ?? null,
      deal_id: formData.deal_id ?? null,
      lead_id: formData.lead_id ?? null,
      is_pinned: formData.is_pinned ?? false,
      created_by: member.id,
    })
    .select(
      `
      *,
      creator:crm_team_members!crm_notes_created_by_fkey(id, full_name, avatar_url)
    `
    )
    .single()

  if (error) {
    console.error("Error creating note:", error)
    return { success: false, error: error.message }
  }

  if (formData.contact_id) revalidatePath(`/contacts/${formData.contact_id}`)
  if (formData.deal_id) revalidatePath(`/deals/${formData.deal_id}`)

  return { success: true, note: data as Note }
}

export async function updateNote(
  id: string,
  formData: { body?: string; is_pinned?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_notes")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Error updating note:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteNote(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("crm_notes").delete().eq("id", id)

  if (error) {
    console.error("Error deleting note:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function togglePinNote(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { data: current } = await supabase
    .from("crm_notes")
    .select("is_pinned")
    .eq("id", id)
    .single()

  if (!current) {
    return { success: false, error: "Note not found" }
  }

  const { error } = await supabase
    .from("crm_notes")
    .update({
      is_pinned: !current.is_pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("Error toggling pin:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

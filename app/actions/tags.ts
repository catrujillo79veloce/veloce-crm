"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Tag } from "@/lib/types"

export async function getTags(): Promise<Tag[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_tags")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error fetching tags:", error)
    return []
  }

  return (data as Tag[]) || []
}

export async function createTag(
  name: string,
  color: string
): Promise<{ success: boolean; error?: string; tag?: Tag }> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_tags")
    .insert({ name, color })
    .select()
    .single()

  if (error) {
    console.error("Error creating tag:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/tags")
  return { success: true, tag: data as Tag }
}

export async function deleteTag(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  // Remove from contact associations first
  await supabase.from("crm_contact_tags").delete().eq("tag_id", id)

  const { error } = await supabase.from("crm_tags").delete().eq("id", id)

  if (error) {
    console.error("Error deleting tag:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/tags")
  return { success: true }
}

export async function tagContact(
  contactId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_contact_tags")
    .insert({ contact_id: contactId, tag_id: tagId })

  if (error) {
    // Ignore duplicate errors
    if (error.code === "23505") {
      return { success: true }
    }
    console.error("Error tagging contact:", error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}

export async function untagContact(
  contactId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("tag_id", tagId)

  if (error) {
    console.error("Error untagging contact:", error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}

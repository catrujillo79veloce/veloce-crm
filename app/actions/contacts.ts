"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { normalizePhone } from "@/lib/utils"
import type {
  Contact,
  ContactSource,
  ContactStatus,
  Interaction,
  Deal,
  Lead,
  Note,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Params & return types
// ---------------------------------------------------------------------------

export interface GetContactsParams {
  page?: number
  pageSize?: number
  search?: string
  source?: ContactSource | ""
  status?: ContactStatus | ""
  tag?: string
  assignedTo?: string
}

export interface GetContactsResult {
  data: Contact[]
  count: number
}

// ---------------------------------------------------------------------------
// getContacts  - list with pagination, search, filters
// ---------------------------------------------------------------------------

export async function getContacts(
  params: GetContactsParams = {}
): Promise<GetContactsResult> {
  const {
    page = 1,
    pageSize = 25,
    search = "",
    source = "",
    status = "",
    tag = "",
    assignedTo = "",
  } = params

  const supabase = createServerSupabaseClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Base query
  let query = supabase
    .from("crm_contacts")
    .select(
      `
      *,
      assigned_member:crm_team_members!crm_contacts_assigned_to_fkey(id, full_name, email, avatar_url),
      crm_contact_tags(
        tag:crm_tags(id, name, color)
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to)

  // Search filter
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    )
  }

  // Source filter
  if (source) {
    query = query.eq("source", source)
  }

  // Status filter
  if (status) {
    query = query.eq("status", status)
  }

  // Assigned to filter
  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo)
  }

  const { data, count, error } = await query

  if (error) {
    console.error("getContacts error:", error)
    return { data: [], count: 0 }
  }

  // Tag filter (post-query because it's a joined table)
  let contacts: Contact[] = (data ?? []).map((row: any) => ({
    ...row,
    assigned_member: row.assigned_member ?? undefined,
    tags: (row.crm_contact_tags ?? [])
      .map((ct: any) => ct.tag)
      .filter(Boolean),
    crm_contact_tags: undefined,
  }))

  if (tag) {
    contacts = contacts.filter((c) =>
      c.tags?.some((t) => t.id === tag || t.name === tag)
    )
  }

  return {
    data: contacts,
    count: tag ? contacts.length : (count ?? 0),
  }
}

// ---------------------------------------------------------------------------
// getContact  - single contact with full data
// ---------------------------------------------------------------------------

export async function getContact(id: string): Promise<Contact | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_contacts")
    .select(
      `
      *,
      assigned_member:crm_team_members!crm_contacts_assigned_to_fkey(id, full_name, email, avatar_url, phone, role),
      crm_contact_tags(
        tag:crm_tags(id, name, color)
      )
    `
    )
    .eq("id", id)
    .single()

  if (error || !data) {
    console.error("getContact error:", error)
    return null
  }

  const row = data as any

  return {
    ...row,
    assigned_member: row.assigned_member ?? undefined,
    tags: (row.crm_contact_tags ?? [])
      .map((ct: any) => ct.tag)
      .filter(Boolean),
    crm_contact_tags: undefined,
  }
}

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------

interface ContactFormData {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  whatsapp_phone?: string
  source: ContactSource
  city?: string
  neighborhood?: string
  cycling_experience?: string
  bike_type?: string
  interests?: string
  notes?: string
  status?: ContactStatus
  assigned_to?: string
}

export async function createContact(
  formData: ContactFormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validation
  if (!formData.first_name?.trim()) {
    return { success: false, error: "El nombre es obligatorio" }
  }

  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    return { success: false, error: "El formato de correo no es valido" }
  }

  const supabase = createServerSupabaseClient()

  const insertData: Record<string, unknown> = {
    first_name: formData.first_name.trim(),
    last_name: formData.last_name.trim(),
    source: formData.source || "manual",
    city: formData.city?.trim() || "Medellin",
    status: formData.status || "active",
  }

  if (formData.email) insertData.email = formData.email.trim().toLowerCase()
  if (formData.phone) insertData.phone = normalizePhone(formData.phone)
  if (formData.whatsapp_phone)
    insertData.whatsapp_phone = normalizePhone(formData.whatsapp_phone)
  if (formData.neighborhood)
    insertData.neighborhood = formData.neighborhood.trim()
  if (formData.cycling_experience)
    insertData.cycling_experience = formData.cycling_experience
  if (formData.bike_type) insertData.bike_type = formData.bike_type.trim()
  if (formData.interests) {
    insertData.interests = formData.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (formData.assigned_to) insertData.assigned_to = formData.assigned_to

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert(insertData)
    .select("id")
    .single()

  if (error) {
    console.error("createContact error:", error)
    return { success: false, error: error.message }
  }

  // If there are notes, create a note record
  if (formData.notes?.trim()) {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: member } = await supabase
        .from("crm_team_members")
        .select("id")
        .eq("auth_user_id", userData.user.id)
        .single()

      if (member) {
        await supabase.from("crm_notes").insert({
          contact_id: data.id,
          body: formData.notes.trim(),
          created_by: member.id,
        })
      }
    }
  }

  revalidatePath("/contacts")
  return { success: true, id: data.id }
}

// ---------------------------------------------------------------------------
// updateContact
// ---------------------------------------------------------------------------

export async function updateContact(
  id: string,
  formData: ContactFormData
): Promise<{ success: boolean; error?: string }> {
  if (!formData.first_name?.trim()) {
    return { success: false, error: "El nombre es obligatorio" }
  }

  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    return { success: false, error: "El formato de correo no es valido" }
  }

  const supabase = createServerSupabaseClient()

  const updateData: Record<string, unknown> = {
    first_name: formData.first_name.trim(),
    last_name: formData.last_name.trim(),
    source: formData.source,
    city: formData.city?.trim() || "Medellin",
    email: formData.email?.trim().toLowerCase() || null,
    phone: formData.phone ? normalizePhone(formData.phone) : null,
    whatsapp_phone: formData.whatsapp_phone
      ? normalizePhone(formData.whatsapp_phone)
      : null,
    neighborhood: formData.neighborhood?.trim() || null,
    cycling_experience: formData.cycling_experience || null,
    bike_type: formData.bike_type?.trim() || null,
    interests: formData.interests
      ? formData.interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    status: formData.status || "active",
    assigned_to: formData.assigned_to || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from("crm_contacts")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("updateContact error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/contacts/${id}`)
  revalidatePath("/contacts")
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteContact
// ---------------------------------------------------------------------------

export async function deleteContact(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_contacts")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("deleteContact error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/contacts")
  return { success: true }
}

// ---------------------------------------------------------------------------
// getContactInteractions - paginated
// ---------------------------------------------------------------------------

export async function getContactInteractions(
  contactId: string,
  page = 1,
  pageSize = 20
): Promise<{ data: Interaction[]; count: number }> {
  const supabase = createServerSupabaseClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from("crm_interactions")
    .select(
      `
      *,
      team_member:crm_team_members!crm_interactions_team_member_id_fkey(id, full_name, avatar_url)
    `,
      { count: "exact" }
    )
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("getContactInteractions error:", error)
    return { data: [], count: 0 }
  }

  return {
    data: (data ?? []).map((row: any) => ({
      ...row,
      team_member: row.team_member ?? undefined,
    })),
    count: count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// getContactDeals
// ---------------------------------------------------------------------------

export async function getContactDeals(contactId: string): Promise<Deal[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_deals")
    .select(
      `
      *,
      assigned_member:crm_team_members!crm_deals_assigned_to_fkey(id, full_name, avatar_url)
    `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getContactDeals error:", error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    assigned_member: row.assigned_member ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// getContactLeads
// ---------------------------------------------------------------------------

export async function getContactLeads(contactId: string): Promise<Lead[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_leads")
    .select(
      `
      *,
      assigned_member:crm_team_members!crm_leads_assigned_to_fkey(id, full_name, avatar_url)
    `
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getContactLeads error:", error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    assigned_member: row.assigned_member ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// getContactNotes
// ---------------------------------------------------------------------------

export async function getContactNotes(contactId: string): Promise<Note[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_notes")
    .select(
      `
      *,
      creator:crm_team_members!crm_notes_created_by_fkey(id, full_name, avatar_url)
    `
    )
    .eq("contact_id", contactId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getContactNotes error:", error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    creator: row.creator ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// createNote
// ---------------------------------------------------------------------------

export async function createNote(
  contactId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!body?.trim()) {
    return { success: false, error: "La nota no puede estar vacia" }
  }

  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "No autorizado" }

  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!member) return { success: false, error: "Miembro no encontrado" }

  const { error } = await supabase.from("crm_notes").insert({
    contact_id: contactId,
    body: body.trim(),
    created_by: member.id,
  })

  if (error) {
    console.error("createNote error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/contacts/${contactId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// togglePinNote
// ---------------------------------------------------------------------------

export async function togglePinNote(
  noteId: string,
  pinned: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_notes")
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq("id", noteId)

  if (error) {
    console.error("togglePinNote error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// getTeamMembers - helper for filters & assignment
// ---------------------------------------------------------------------------

export async function getTeamMembers() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_team_members")
    .select("id, full_name, email, avatar_url, role")
    .eq("is_active", true)
    .order("full_name")

  if (error) {
    console.error("getTeamMembers error:", error)
    return []
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// getTags - helper for filters
// ---------------------------------------------------------------------------

export async function getTags() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_tags")
    .select("id, name, color")
    .order("name")

  if (error) {
    console.error("getTags error:", error)
    return []
  }

  return data ?? []
}

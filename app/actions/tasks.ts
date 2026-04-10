"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Task, TaskStatus, Priority } from "@/lib/types"

export interface TaskFilters {
  status?: TaskStatus | "all"
  assigned_to?: string
  due_from?: string
  due_to?: string
  search?: string
}

export async function getTasks(filters?: TaskFilters): Promise<Task[]> {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from("crm_tasks")
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, avatar_url),
      assigned_member:crm_team_members!crm_tasks_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .order("due_date", { ascending: true, nullsFirst: false })

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }

  if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to)
  }

  if (filters?.due_from) {
    query = query.gte("due_date", filters.due_from)
  }

  if (filters?.due_to) {
    query = query.lte("due_date", filters.due_to)
  }

  if (filters?.search) {
    query = query.ilike("title", `%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching tasks:", error)
    return []
  }

  return (data || []) as Task[]
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  contact_id?: string | null
  lead_id?: string | null
  deal_id?: string | null
  assigned_to: string
  priority: Priority
  due_date?: string | null
}

export async function createTask(
  input: CreateTaskInput
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  // Get the team_member id for created_by
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      ...input,
      status: "pending" as TaskStatus,
      created_by: member?.id || user.id,
    })
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, avatar_url),
      assigned_member:crm_team_members!crm_tasks_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error creating task:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/tasks")
  return { data: data as Task, error: null }
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  contact_id?: string | null
  assigned_to?: string
  priority?: Priority
  status?: TaskStatus
  due_date?: string | null
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_tasks")
    .update(input)
    .eq("id", id)
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, avatar_url),
      assigned_member:crm_team_members!crm_tasks_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error updating task:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/tasks")
  return { data: data as Task, error: null }
}

export async function completeTask(
  id: string
): Promise<{ data: Task | null; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_tasks")
    .update({
      status: "completed" as TaskStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      contact:crm_contacts(id, first_name, last_name, email, avatar_url),
      assigned_member:crm_team_members!crm_tasks_assigned_to_fkey(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error completing task:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/tasks")
  return { data: data as Task, error: null }
}

export async function deleteTask(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from("crm_tasks").delete().eq("id", id)

  if (error) {
    console.error("Error deleting task:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/tasks")
  return { success: true, error: null }
}

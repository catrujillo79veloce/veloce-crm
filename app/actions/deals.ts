"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Deal, DealStage, DealProduct } from "@/lib/types"

export interface DealsGroupedByStage {
  [stage: string]: Deal[]
}

export async function getDeals(): Promise<DealsGroupedByStage> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_deals")
    .select(
      `
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url),
      assigned_member:crm_team_members!crm_deals_assigned_to_fkey(id, full_name, avatar_url)
    `
    )
    .order("position", { ascending: true })

  if (error) {
    console.error("Error fetching deals:", error)
    return {}
  }

  const grouped: DealsGroupedByStage = {}
  for (const deal of (data as Deal[]) || []) {
    if (!grouped[deal.stage]) {
      grouped[deal.stage] = []
    }
    grouped[deal.stage].push(deal)
  }

  return grouped
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_deals")
    .select(
      `
      *,
      contact:crm_contacts(id, first_name, last_name, email, phone, avatar_url, whatsapp_phone),
      assigned_member:crm_team_members!crm_deals_assigned_to_fkey(id, full_name, avatar_url, email),
      products:crm_deal_products(
        id,
        deal_id,
        product_id,
        quantity,
        unit_price,
        discount_percent,
        total,
        product:crm_products(id, name, brand, category, sku, price, image_url)
      )
    `
    )
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching deal:", error)
    return null
  }

  return data as Deal
}

export async function createDeal(formData: {
  title: string
  contact_id: string
  stage?: DealStage
  amount?: number | null
  probability?: number
  assigned_to?: string | null
  expected_close_date?: string | null
  lead_id?: string | null
}): Promise<{ success: boolean; error?: string; deal?: Deal }> {
  const supabase = createServerSupabaseClient()

  // Get the max position for the stage
  const stage = formData.stage || "qualification"
  const { data: maxPos } = await supabase
    .from("crm_deals")
    .select("position")
    .eq("stage", stage)
    .order("position", { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1

  const { data, error } = await supabase
    .from("crm_deals")
    .insert({
      title: formData.title,
      contact_id: formData.contact_id,
      stage,
      amount: formData.amount ?? null,
      probability: formData.probability ?? 0,
      assigned_to: formData.assigned_to ?? null,
      expected_close_date: formData.expected_close_date ?? null,
      lead_id: formData.lead_id ?? null,
      currency: "COP",
      position,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating deal:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/deals")
  return { success: true, deal: data as Deal }
}

export async function updateDeal(
  id: string,
  formData: {
    title?: string
    contact_id?: string
    stage?: DealStage
    amount?: number | null
    probability?: number
    assigned_to?: string | null
    expected_close_date?: string | null
    lost_reason?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const updateData: Record<string, unknown> = { ...formData, updated_at: new Date().toISOString() }

  // If stage is closed_won, set closed_at
  if (formData.stage === "closed_won" || formData.stage === "closed_lost") {
    updateData.closed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("crm_deals")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("Error updating deal:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/deals")
  revalidatePath(`/deals/${id}`)
  return { success: true }
}

export async function updateDealStage(
  id: string,
  newStage: DealStage,
  newPosition: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const updateData: Record<string, unknown> = {
    stage: newStage,
    position: newPosition,
    updated_at: new Date().toISOString(),
  }

  if (newStage === "closed_won" || newStage === "closed_lost") {
    updateData.closed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("crm_deals")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("Error updating deal stage:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/deals")
  return { success: true }
}

export async function addProductToDeal(
  dealId: string,
  productId: string,
  quantity: number,
  unitPrice: number,
  discount: number
): Promise<{ success: boolean; error?: string; dealProduct?: DealProduct }> {
  const supabase = createServerSupabaseClient()

  const total = quantity * unitPrice * (1 - discount / 100)

  const { data, error } = await supabase
    .from("crm_deal_products")
    .insert({
      deal_id: dealId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      discount_percent: discount,
      total,
    })
    .select(
      `
      *,
      product:crm_products(id, name, brand, category, sku, price, image_url)
    `
    )
    .single()

  if (error) {
    console.error("Error adding product to deal:", error)
    return { success: false, error: error.message }
  }

  // Recalculate deal amount
  await recalculateDealAmount(dealId)

  revalidatePath(`/deals/${dealId}`)
  return { success: true, dealProduct: data as DealProduct }
}

export async function removeProductFromDeal(
  dealProductId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  // Get deal_id before deleting
  const { data: dp } = await supabase
    .from("crm_deal_products")
    .select("deal_id")
    .eq("id", dealProductId)
    .single()

  const { error } = await supabase
    .from("crm_deal_products")
    .delete()
    .eq("id", dealProductId)

  if (error) {
    console.error("Error removing product from deal:", error)
    return { success: false, error: error.message }
  }

  if (dp?.deal_id) {
    await recalculateDealAmount(dp.deal_id)
    revalidatePath(`/deals/${dp.deal_id}`)
  }

  return { success: true }
}

async function recalculateDealAmount(dealId: string) {
  const supabase = createServerSupabaseClient()

  const { data: products } = await supabase
    .from("crm_deal_products")
    .select("total")
    .eq("deal_id", dealId)

  const totalAmount = (products || []).reduce(
    (sum: number, p: { total: number }) => sum + p.total,
    0
  )

  await supabase
    .from("crm_deals")
    .update({ amount: totalAmount, updated_at: new Date().toISOString() })
    .eq("id", dealId)
}

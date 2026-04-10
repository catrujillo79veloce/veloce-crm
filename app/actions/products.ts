"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Product, ProductCategory } from "@/lib/types"

export interface ProductFilters {
  category?: ProductCategory | null
  search?: string
  in_stock?: boolean | null
  is_active?: boolean | null
  page?: number
  pageSize?: number
}

export interface PaginatedProducts {
  products: Product[]
  total: number
  page: number
  pageSize: number
}

export async function getProducts(
  filters: ProductFilters = {}
): Promise<PaginatedProducts> {
  const supabase = createServerSupabaseClient()
  const { category, search, in_stock, is_active, page = 1, pageSize = 20 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("crm_products")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })

  if (category) {
    query = query.eq("category", category)
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,brand.ilike.%${search}%,sku.ilike.%${search}%`
    )
  }

  if (in_stock !== null && in_stock !== undefined) {
    query = query.eq("in_stock", in_stock)
  }

  if (is_active !== null && is_active !== undefined) {
    query = query.eq("is_active", is_active)
  }

  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching products:", error)
    return { products: [], total: 0, page, pageSize }
  }

  return {
    products: (data as Product[]) || [],
    total: count || 0,
    page,
    pageSize,
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_products")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching product:", error)
    return null
  }

  return data as Product
}

export async function createProduct(formData: {
  name: string
  brand?: string | null
  category: ProductCategory
  sku?: string | null
  price: number
  cost?: number | null
  description?: string | null
  stock_quantity?: number
  in_stock?: boolean
}): Promise<{ success: boolean; error?: string; product?: Product }> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_products")
    .insert({
      name: formData.name,
      brand: formData.brand ?? null,
      category: formData.category,
      sku: formData.sku ?? null,
      price: formData.price,
      cost: formData.cost ?? null,
      currency: "COP",
      description: formData.description ?? null,
      stock_quantity: formData.stock_quantity ?? 0,
      in_stock: formData.in_stock ?? true,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/products")
  return { success: true, product: data as Product }
}

export async function updateProduct(
  id: string,
  formData: {
    name?: string
    brand?: string | null
    category?: ProductCategory
    sku?: string | null
    price?: number
    cost?: number | null
    description?: string | null
    stock_quantity?: number
    in_stock?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from("crm_products")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Error updating product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/products")
  return { success: true }
}

export async function toggleProductActive(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient()

  // Get current status
  const { data: current } = await supabase
    .from("crm_products")
    .select("is_active")
    .eq("id", id)
    .single()

  if (!current) {
    return { success: false, error: "Product not found" }
  }

  const { error } = await supabase
    .from("crm_products")
    .update({
      is_active: !current.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("Error toggling product:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/products")
  return { success: true }
}

export async function searchProducts(
  query: string
): Promise<Product[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("crm_products")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%,sku.ilike.%${query}%`)
    .order("name")
    .limit(20)

  if (error) {
    console.error("Error searching products:", error)
    return []
  }

  return (data as Product[]) || []
}

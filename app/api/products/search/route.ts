import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/products/search?q=...&brand=...&category=...&limit=10
//
// Fuzzy product search across name + brand + description, returning a
// compact JSON shape suitable for both the UI search and (later) tool-use
// by the AI agent. Requires team-member auth.
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string
  name: string
  brand: string | null
  category: string
  price: number
  sale_price: number | null
  currency: string
  image_url: string | null
  sizes: string[]
  external_url: string | null
  in_stock: boolean
  stock_quantity: number
  slug: string | null
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const brand = request.nextUrl.searchParams.get("brand")?.trim() ?? ""
  const category = request.nextUrl.searchParams.get("category")?.trim() ?? ""
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "10")
  const limit = Math.min(Math.max(limitRaw, 1), 50)

  const select =
    "id, name, brand, category, price, sale_price, currency, image_url, sizes, external_url, in_stock, stock_quantity, slug"

  let query = supabase
    .from("crm_products")
    .select(select)
    .eq("is_active", true)
    .order("in_stock", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit)

  if (q.length >= 2) {
    const pattern = `%${q}%`
    query = query.or(
      `name.ilike.${pattern},brand.ilike.${pattern},description.ilike.${pattern},sku.ilike.${pattern}`
    )
  }
  if (brand) query = query.ilike("brand", brand)
  if (category) query = query.eq("category", category)

  const { data, error } = await query
  if (error) {
    console.error("[Products Search] Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    items: (data ?? []) as SearchResult[],
  })
}

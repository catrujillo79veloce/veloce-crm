import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// POST /api/products/import
// Body: { rows: Array<ProductImportRow>, mode: "upsert" | "insert" }
//
// Bulk-loads products from a CSV uploaded in the UI. Required column:
//   name
// Recommended: brand, category, price, currency, image_url, sizes
//   (sizes as comma-separated, e.g. "S,M,L"), external_url, sku.
//
// Mode "upsert" matches existing rows by sku (when sku is provided);
// "insert" always creates new rows.
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  "bicycle",
  "component",
  "apparel",
  "accessory",
  "nutrition",
  "service",
  "other",
] as const
type Category = (typeof VALID_CATEGORIES)[number]

interface ImportRow {
  name: string
  brand?: string | null
  category?: string | null
  sku?: string | null
  price?: number | string | null
  sale_price?: number | string | null
  currency?: string | null
  description?: string | null
  image_url?: string | null
  external_url?: string | null
  sizes?: string | string[] | null
  in_stock?: boolean | string | null
  stock_quantity?: number | string | null
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.\-]/g, "")) : Number(v)
  return Number.isFinite(n) ? n : null
}

function toSizesArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (typeof v === "string") {
    return v
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeCategory(v: unknown): Category {
  const lc = String(v ?? "")
    .toLowerCase()
    .trim()
  if ((VALID_CATEGORIES as readonly string[]).includes(lc)) return lc as Category
  // Common Spanish synonyms
  const map: Record<string, Category> = {
    bici: "bicycle",
    bicicleta: "bicycle",
    bike: "bicycle",
    componente: "component",
    componentes: "component",
    ropa: "apparel",
    accesorio: "accessory",
    accesorios: "accessory",
    nutricion: "nutrition",
    nutrición: "nutrition",
    suplemento: "nutrition",
    servicio: "service",
    taller: "service",
  }
  return map[lc] ?? "other"
}

function toBoolean(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "string") {
    const lc = v.toLowerCase().trim()
    if (["true", "1", "si", "sí", "yes", "y"].includes(lc)) return true
    if (["false", "0", "no", "n"].includes(lc)) return false
  }
  return fallback
}

export async function POST(request: NextRequest) {
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
  const { data: member } = await supabase
    .from("crm_team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single()
  if (!member) {
    return NextResponse.json(
      { success: false, error: "Sin permisos" },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : []
  const mode: "upsert" | "insert" = body?.mode === "insert" ? "insert" : "upsert"

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Sin filas para importar" },
      { status: 400 }
    )
  }
  if (rows.length > 2000) {
    return NextResponse.json(
      { success: false, error: "Maximo 2000 productos por import" },
      { status: 400 }
    )
  }

  // --- Normalize rows ---
  const ready: Record<string, unknown>[] = []
  const errors: { row: number; error: string }[] = []

  rows.forEach((raw, idx) => {
    const name = String(raw?.name ?? "").trim()
    if (!name) {
      errors.push({ row: idx + 1, error: "Falta nombre" })
      return
    }
    ready.push({
      name,
      brand: raw.brand?.toString().trim() || null,
      category: normalizeCategory(raw.category),
      sku: raw.sku?.toString().trim() || null,
      price: toNumberOrNull(raw.price) ?? 0,
      sale_price: toNumberOrNull(raw.sale_price),
      currency: raw.currency?.toString().trim() || "COP",
      description: raw.description?.toString().trim() || null,
      image_url: raw.image_url?.toString().trim() || null,
      external_url: raw.external_url?.toString().trim() || null,
      sizes: toSizesArray(raw.sizes),
      in_stock: toBoolean(raw.in_stock, true),
      stock_quantity: toNumberOrNull(raw.stock_quantity) ?? 0,
      is_active: true,
    })
  })

  if (ready.length === 0) {
    return NextResponse.json(
      { success: false, error: "Ninguna fila valida", errors },
      { status: 400 }
    )
  }

  // --- Insert / Upsert ---
  let inserted = 0
  let updated = 0
  if (mode === "upsert") {
    // Only the rows with a SKU can be upserted; the rest go through insert
    const withSku = ready.filter((r) => r.sku)
    const withoutSku = ready.filter((r) => !r.sku)

    if (withSku.length > 0) {
      const { error: upErr, count } = await supabase
        .from("crm_products")
        .upsert(withSku, { onConflict: "sku", count: "exact" })
      if (upErr) {
        console.error("[Products Import] Upsert err:", upErr)
        return NextResponse.json(
          { success: false, error: upErr.message },
          { status: 500 }
        )
      }
      updated = count ?? 0
    }
    if (withoutSku.length > 0) {
      const { error: insErr } = await supabase
        .from("crm_products")
        .insert(withoutSku)
      if (insErr) {
        console.error("[Products Import] Insert err:", insErr)
        return NextResponse.json(
          { success: false, error: insErr.message },
          { status: 500 }
        )
      }
      inserted = withoutSku.length
    }
  } else {
    const { error: insErr } = await supabase
      .from("crm_products")
      .insert(ready)
    if (insErr) {
      return NextResponse.json(
        { success: false, error: insErr.message },
        { status: 500 }
      )
    }
    inserted = ready.length
  }

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    skipped: errors.length,
    errors,
  })
}

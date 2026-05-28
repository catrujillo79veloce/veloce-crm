// ---------------------------------------------------------------------------
// Catalog context for the Veloce AI agent.
//
// Fetches the active product catalog from crm_products and formats it as a
// compact text block that gets injected into the agent's system prompt, so
// the bot can quote REAL prices and availability instead of deferring every
// product question to a human.
//
// The catalog is small (~10-30 products), so we inject all of it rather than
// doing keyword retrieval. A 60-second in-memory cache avoids hitting the DB
// on every inbound message during a busy conversation burst.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin"

interface CatalogCacheEntry {
  block: string
  fetchedAt: number
}

let cache: CatalogCacheEntry | null = null
const CACHE_TTL_MS = 60_000

function fmtCop(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO")
}

const CATEGORY_LABELS: Record<string, string> = {
  road_bike: "Ruta",
  mtb: "MTB",
  gravel: "Gravel",
  urban: "Urbana",
  accessories: "Accesorios",
  components: "Componentes",
  clothing: "Ropa",
  indoor_cycling: "Indoor Cycling",
  service: "Servicio",
}

export async function getCatalogBlock(): Promise<string> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.block
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("crm_products")
      .select(
        "name, brand, category, price, sale_price, in_stock, stock_quantity, sizes"
      )
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("price", { ascending: false })

    if (error || !data || data.length === 0) {
      return ""
    }

    const lines = data.map((p) => {
      const cat = CATEGORY_LABELS[p.category as string] ?? p.category
      const priceStr = p.sale_price
        ? `${fmtCop(Number(p.sale_price))} (antes ${fmtCop(Number(p.price))}, OFERTA)`
        : fmtCop(Number(p.price))
      const stock = p.in_stock ? "disponible" : "agotado"
      const sizes =
        Array.isArray(p.sizes) && p.sizes.length > 0
          ? ` | tallas: ${(p.sizes as string[]).join(", ")}`
          : ""
      const brand = p.brand ? `${p.brand} ` : ""
      return `- [${cat}] ${brand}${p.name} — ${priceStr} (${stock})${sizes}`
    })

    const block = `## CATALOGO ACTUAL (precios reales, usa SIEMPRE estos datos)\n${lines.join("\n")}`

    cache = { block, fetchedAt: Date.now() }
    return block
  } catch (e) {
    console.error("[CatalogContext] Failed to load catalog:", e)
    return ""
  }
}

/** Invalidate the cache (call after a product update if needed). */
export function clearCatalogCache(): void {
  cache = null
}

// ---------------------------------------------------------------------------
// Catalog data for the public /veloce landing page.
//
// The landing used to carry its prices as hand-written strings, so every
// change Carlos made in /products left the page quoting last month's figures
// to the very people who are about to write us. Like the AI agent
// (lib/ai/catalog-context.ts), it now reads crm_products and formats the
// prices the same way: sale_price is the price we show, price becomes the
// struck-through "antes".
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import type { ProductCategory } from "@/lib/types"

/**
 * How long the landing may serve prices from a cached DB read. Keep in sync
 * with the `revalidate` export in app/veloce/page.tsx. 60s matches the
 * agent's catalog cache, so the bot and the landing never quote a customer
 * two different prices.
 */
export const LANDING_REVALIDATE_SECONDS = 60

/** Two full rows of the 3-column product grid. */
const MAX_FEATURED = 6

/**
 * The crm_products row behind the Bike Fit card. It shares the `service`
 * category with the workshop jobs, so the workshop card prices every service
 * except this one.
 */
const BIKE_FIT_NAME = "Bike Fit Retul 3D"

/** Shown instead of a price when a product has no row in crm_products yet. */
const NO_PRICE = "Consulta"

/** Rendered in their own cards, so they stay out of the product grid. */
const SERVICE_CATEGORIES: ProductCategory[] = ["service", "indoor_cycling"]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c.label.es])
)

interface CatalogRow {
  name: string
  category: ProductCategory
  price: number | string
  sale_price: number | string | null
  in_stock: boolean
}

export interface FeaturedProduct {
  name: string
  category: string
  price: string
  /** The pre-offer price, struck through next to `price`. */
  oldPrice: string | null
  badge: string | null
}

export interface ServicePrices {
  bikeFit: string
  indoorCycling: string
  workshop: string
}

export interface LandingCatalog {
  featured: FeaturedProduct[]
  services: ServicePrices
}

/** Same COP formatting the agent quotes: "$14.900.000". */
function fmtCop(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO")
}

function hasOffer(row: CatalogRow): boolean {
  return row.sale_price !== null && Number(row.sale_price) > 0
}

/** What the customer actually pays today. */
function effectivePrice(row: CatalogRow): number {
  return Number(hasOffer(row) ? row.sale_price : row.price)
}

function lowestPrice(rows: CatalogRow[]): string {
  if (rows.length === 0) return NO_PRICE
  return `Desde ${fmtCop(Math.min(...rows.map(effectivePrice)))}`
}

/**
 * The landing is public and anonymous, but RLS on crm_products only grants
 * SELECT to CRM team members, so the anon key reads zero rows here. This
 * module is server-only, so the service-role key never reaches the browser.
 *
 * Not createAdminClient(): that client is shared with the webhooks and API
 * routes that must never read stale data, while this read is deliberately
 * cached. Next 14 caches fetches indefinitely unless told otherwise, which
 * would pin the landing to the prices of the last deploy.
 */
function createLandingClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            next: { revalidate: LANDING_REVALIDATE_SECONDS },
          }),
      },
    }
  )
}

function toFeatured(row: CatalogRow): FeaturedProduct {
  const offer = hasOffer(row)
  return {
    name: row.name,
    category: CATEGORY_LABELS[row.category] ?? row.category,
    price: fmtCop(effectivePrice(row)),
    oldPrice: offer ? fmtCop(Number(row.price)) : null,
    badge: offer ? "OFERTA" : null,
  }
}

/**
 * Picks the products the grid shows: offers first (they are what paid traffic
 * responds to), then the most expensive, then alphabetically so the order
 * does not shuffle between renders. No hand-picked names — whatever Carlos
 * activates and prices in /products is what the landing shows.
 *
 * Out-of-stock products are left out: there is no point sending ad traffic to
 * something we cannot sell today.
 */
function pickFeatured(rows: CatalogRow[]): FeaturedProduct[] {
  return rows
    .filter((r) => r.in_stock && !SERVICE_CATEGORIES.includes(r.category))
    .sort((a, b) => {
      const byOffer = Number(hasOffer(b)) - Number(hasOffer(a))
      if (byOffer !== 0) return byOffer
      const byPrice = effectivePrice(b) - effectivePrice(a)
      if (byPrice !== 0) return byPrice
      return a.name.localeCompare(b.name, "es")
    })
    .slice(0, MAX_FEATURED)
    .map(toFeatured)
}

/**
 * Service prices are not filtered by in_stock: a service flagged out of stock
 * is still a service we price, and dropping to "Consulta" would hide a real
 * price. To take a service off the landing, deactivate its row.
 */
function pickServices(rows: CatalogRow[]): ServicePrices {
  const bikeFit = rows.find((r) => r.name === BIKE_FIT_NAME)
  return {
    bikeFit: bikeFit ? fmtCop(effectivePrice(bikeFit)) : NO_PRICE,
    indoorCycling: lowestPrice(
      rows.filter((r) => r.category === "indoor_cycling")
    ),
    workshop: lowestPrice(
      rows.filter((r) => r.category === "service" && r.name !== BIKE_FIT_NAME)
    ),
  }
}

const EMPTY_CATALOG: LandingCatalog = {
  featured: [],
  services: {
    bikeFit: NO_PRICE,
    indoorCycling: NO_PRICE,
    workshop: NO_PRICE,
  },
}

/**
 * Never throws: if the catalog cannot be read the landing drops the product
 * grid and offers "Consulta" instead of a blank or invented price, so the
 * page — and its ad conversions — keep working.
 */
export async function getLandingCatalog(): Promise<LandingCatalog> {
  try {
    const supabase = createLandingClient()
    const { data, error } = await supabase
      .from("crm_products")
      .select("name, category, price, sale_price, in_stock")
      .eq("is_active", true)

    if (error || !data || data.length === 0) {
      if (error) {
        console.error("[LandingCatalog] Failed to load catalog:", error)
      }
      return EMPTY_CATALOG
    }

    const rows = data as CatalogRow[]
    return { featured: pickFeatured(rows), services: pickServices(rows) }
  } catch (e) {
    console.error("[LandingCatalog] Failed to load catalog:", e)
    return EMPTY_CATALOG
  }
}

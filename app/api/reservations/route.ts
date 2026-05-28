import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncContactPipeline } from "@/lib/ai/pipeline"

// ---------------------------------------------------------------------------
// GET /api/reservations - List reservations
// POST /api/reservations - Create a reservation (separar bici)
// Money is recorded only; never auto-charged.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const status = params.get("status")
  const contactId = params.get("contact_id")

  let query = supabase
    .from("crm_reservations")
    .select(
      `
      id, reservation_number, product_name, total_price_cop, deposit_cop,
      deposit_pct, balance_cop, status, deposit_paid, deposit_paid_at,
      payment_method, expires_at, notes, created_by, created_at,
      cancelled_at, cancelled_reason, completed_at,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone, phone ),
      product:crm_products ( id, name, sku )
    `
    )
    .order("created_at", { ascending: false })

  if (contactId) query = query.eq("contact_id", contactId)
  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean)
    if (statuses.length === 1 && statuses[0] === "active") {
      query = query.in("status", ["pending_payment", "reserved"])
    } else if (statuses.length > 0) {
      query = query.in("status", statuses)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reservations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    contact_id,
    product_id,
    product_name,
    total_price_cop,
    deposit_cop,
    deposit_pct,
    payment_method,
    expires_at,
    notes,
    created_by = "admin",
  } = body

  if (!contact_id || !product_name || total_price_cop == null) {
    return NextResponse.json(
      { error: "Faltan campos: contact_id, product_name, total_price_cop" },
      { status: 400 }
    )
  }

  const total = Math.round(Number(total_price_cop))
  if (!Number.isFinite(total) || total < 0) {
    return NextResponse.json({ error: "total_price_cop inválido" }, { status: 400 })
  }

  // Resolve deposit: prefer explicit deposit_cop, else compute from pct
  let depositPct: number | null = null
  let depositCop: number

  if (deposit_cop != null) {
    depositCop = Math.round(Number(deposit_cop))
    depositPct = total > 0 ? Number(((depositCop / total) * 100).toFixed(2)) : null
  } else {
    // Use provided pct or default from settings
    let pct = deposit_pct != null ? Number(deposit_pct) : null
    if (pct == null) {
      const { data: setting } = await supabase
        .from("crm_app_settings")
        .select("value")
        .eq("key", "reservation_default_deposit_pct")
        .maybeSingle()
      pct = setting?.value != null ? Number(setting.value) : 30
    }
    depositPct = pct
    depositCop = Math.round((total * pct) / 100)
  }

  if (depositCop > total) {
    return NextResponse.json(
      { error: "El abono no puede ser mayor al total" },
      { status: 400 }
    )
  }

  const balance = total - depositCop

  // Resolve expiry
  let expiresAt = expires_at
  if (!expiresAt) {
    const { data: setting } = await supabase
      .from("crm_app_settings")
      .select("value")
      .eq("key", "reservation_default_validity_days")
      .maybeSingle()
    const days = setting?.value != null ? Number(setting.value) : 8
    const d = new Date()
    d.setDate(d.getDate() + days)
    expiresAt = d.toISOString().slice(0, 10)
  }

  const { data, error } = await supabase
    .from("crm_reservations")
    .insert({
      contact_id,
      product_id: product_id ?? null,
      product_name,
      total_price_cop: total,
      deposit_cop: depositCop,
      deposit_pct: depositPct,
      balance_cop: balance,
      payment_method: payment_method ?? null,
      expires_at: expiresAt,
      notes: notes ?? null,
      created_by,
      created_by_user: user.id,
    })
    .select(
      `
      id, reservation_number, product_name, total_price_cop, deposit_cop,
      deposit_pct, balance_cop, status, expires_at,
      contact:crm_contacts ( id, first_name, last_name, whatsapp_phone )
    `
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Advance the contact's pipeline lead to "negotiation" (fire-and-forget).
  syncContactPipeline(createAdminClient(), contact_id).catch((e) =>
    console.error("[Reservations] Pipeline sync failed:", e)
  )

  return NextResponse.json({ reservation: data }, { status: 201 })
}

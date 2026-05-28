import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/search?q=...
// Unified global search across contacts, products, reservations and workshop
// tickets. Returns categorized results for the top-bar command palette.
// ---------------------------------------------------------------------------

export interface SearchHit {
  type: "contact" | "product" | "reservation" | "ticket"
  id: string
  title: string
  subtitle: string
  href: string
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ hits: [] })

  const like = `%${q}%`
  const numeric = parseInt(q, 10)

  const [contacts, products, reservations, tickets] = await Promise.all([
    supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, whatsapp_phone, phone, email")
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},whatsapp_phone.ilike.${like},phone.ilike.${like},email.ilike.${like}`
      )
      .limit(5),
    supabase
      .from("crm_products")
      .select("id, name, brand, price, sale_price")
      .eq("is_active", true)
      .or(`name.ilike.${like},brand.ilike.${like}`)
      .limit(5),
    supabase
      .from("crm_reservations")
      .select("id, reservation_number, product_name, status")
      .ilike("product_name", like)
      .limit(4),
    supabase
      .from("crm_service_tickets")
      .select("id, ticket_number, bike_description, status")
      .ilike("bike_description", like)
      .limit(4),
  ])

  const hits: SearchHit[] = []

  for (const c of contacts.data ?? []) {
    const name = `${c.first_name}${c.last_name ? " " + c.last_name : ""}`
    hits.push({
      type: "contact",
      id: c.id,
      title: name,
      subtitle: c.whatsapp_phone ?? c.phone ?? c.email ?? "Contacto",
      href: `/contacts/${c.id}`,
    })
  }

  for (const p of products.data ?? []) {
    const price = p.sale_price ?? p.price
    hits.push({
      type: "product",
      id: p.id,
      title: `${p.brand ? p.brand + " " : ""}${p.name}`,
      subtitle: "$" + Number(price).toLocaleString("es-CO"),
      href: "/products",
    })
  }

  for (const r of reservations.data ?? []) {
    hits.push({
      type: "reservation",
      id: r.id,
      title: `Reserva #${r.reservation_number} · ${r.product_name}`,
      subtitle: r.status as string,
      href: "/reservas",
    })
  }

  for (const t of tickets.data ?? []) {
    hits.push({
      type: "ticket",
      id: t.id,
      title: `Ticket #${t.ticket_number} · ${t.bike_description}`,
      subtitle: t.status as string,
      href: "/taller",
    })
  }

  // Numeric query → also match reservation/ticket numbers
  if (Number.isFinite(numeric)) {
    const [resByNum, ticketByNum] = await Promise.all([
      supabase
        .from("crm_reservations")
        .select("id, reservation_number, product_name, status")
        .eq("reservation_number", numeric)
        .limit(2),
      supabase
        .from("crm_service_tickets")
        .select("id, ticket_number, bike_description, status")
        .eq("ticket_number", numeric)
        .limit(2),
    ])
    for (const r of resByNum.data ?? []) {
      if (!hits.some((h) => h.type === "reservation" && h.id === r.id)) {
        hits.push({
          type: "reservation",
          id: r.id,
          title: `Reserva #${r.reservation_number} · ${r.product_name}`,
          subtitle: r.status as string,
          href: "/reservas",
        })
      }
    }
    for (const t of ticketByNum.data ?? []) {
      if (!hits.some((h) => h.type === "ticket" && h.id === t.id)) {
        hits.push({
          type: "ticket",
          id: t.id,
          title: `Ticket #${t.ticket_number} · ${t.bike_description}`,
          subtitle: t.status as string,
          href: "/taller",
        })
      }
    }
  }

  return NextResponse.json({ hits })
}

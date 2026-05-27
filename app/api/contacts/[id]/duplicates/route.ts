import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { normalizePhone } from "@/lib/utils"

// ---------------------------------------------------------------------------
// GET /api/contacts/:id/duplicates
//
// Returns candidate duplicate contacts that share at least one of these
// signals with the given contact:
//   - normalized whatsapp_phone or phone
//   - email (case-insensitive)
//   - instagram_id
//   - facebook_id
//   - same first_name + last_name (case-insensitive) in the same city
//
// Each candidate includes a `matched_on` array so the UI can show WHY it
// was suggested.
// ---------------------------------------------------------------------------

interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  whatsapp_phone: string | null
  facebook_id: string | null
  instagram_id: string | null
  source: string | null
  status: string | null
  avatar_url: string | null
  created_at: string
  matched_on: string[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Fetch the source contact
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select(
      "id, first_name, last_name, email, phone, whatsapp_phone, facebook_id, instagram_id, city"
    )
    .eq("id", params.id)
    .single()
  if (!contact) {
    return NextResponse.json(
      { success: false, error: "Contacto no encontrado" },
      { status: 404 }
    )
  }

  const normPhone = contact.phone ? normalizePhone(contact.phone) : null
  const normWhats = contact.whatsapp_phone
    ? normalizePhone(contact.whatsapp_phone)
    : null
  const emailLc = contact.email?.toLowerCase().trim() || null
  const fullName =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim().toLowerCase()

  // Collect candidates from multiple OR conditions, then merge in JS so we
  // can attach a per-candidate `matched_on` reason list.
  const candidates = new Map<string, Candidate>()

  const addCandidate = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row: any,
    reason: string
  ) => {
    if (!row || row.id === contact.id) return
    const existing = candidates.get(row.id)
    if (existing) {
      if (!existing.matched_on.includes(reason)) {
        existing.matched_on.push(reason)
      }
      return
    }
    candidates.set(row.id, {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      whatsapp_phone: row.whatsapp_phone,
      facebook_id: row.facebook_id,
      instagram_id: row.instagram_id,
      source: row.source,
      status: row.status,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      matched_on: [reason],
    })
  }

  const baseSelect =
    "id, first_name, last_name, email, phone, whatsapp_phone, facebook_id, instagram_id, source, status, avatar_url, created_at, city"

  // --- WhatsApp / phone matches ---
  for (const candidate of [normWhats, normPhone].filter(Boolean) as string[]) {
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select(baseSelect)
      .or(`whatsapp_phone.eq.${candidate},phone.eq.${candidate}`)
      .neq("id", contact.id)
      .limit(20)
    for (const row of rows ?? []) addCandidate(row, "telefono")
  }

  // --- Email ---
  if (emailLc) {
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select(baseSelect)
      .ilike("email", emailLc)
      .neq("id", contact.id)
      .limit(20)
    for (const row of rows ?? []) addCandidate(row, "email")
  }

  // --- Instagram ---
  if (contact.instagram_id) {
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select(baseSelect)
      .eq("instagram_id", contact.instagram_id)
      .neq("id", contact.id)
      .limit(20)
    for (const row of rows ?? []) addCandidate(row, "instagram")
  }

  // --- Facebook ---
  if (contact.facebook_id) {
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select(baseSelect)
      .eq("facebook_id", contact.facebook_id)
      .neq("id", contact.id)
      .limit(20)
    for (const row of rows ?? []) addCandidate(row, "facebook")
  }

  // --- Same name + city (fuzzy) ---
  if (fullName && fullName.length > 3) {
    const { data: rows } = await supabase
      .from("crm_contacts")
      .select(baseSelect)
      .ilike("first_name", contact.first_name)
      .ilike("last_name", contact.last_name)
      .neq("id", contact.id)
      .limit(20)
    for (const row of rows ?? []) {
      if ((row.city ?? "") === (contact.city ?? "")) {
        addCandidate(row, "nombre+ciudad")
      }
    }
  }

  const list = Array.from(candidates.values()).sort(
    (a, b) => b.matched_on.length - a.matched_on.length
  )

  return NextResponse.json({ success: true, candidates: list })
}

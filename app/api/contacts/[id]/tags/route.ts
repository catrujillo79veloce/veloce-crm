import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET    /api/contacts/[id]/tags  → { applied: [...], available: [...] }
// POST   /api/contacts/[id]/tags  { tag_id }  → add tag (manual)
// DELETE /api/contacts/[id]/tags  { tag_id }  → remove tag
// ---------------------------------------------------------------------------

async function auth() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: allTags }, { data: applied }] = await Promise.all([
    supabase.from("crm_tags").select("id, name, color").order("name"),
    supabase
      .from("crm_contact_tags")
      .select("tag_id, source, tag:crm_tags ( id, name, color )")
      .eq("contact_id", id),
  ])

  return NextResponse.json({
    available: allTags ?? [],
    applied: (applied ?? []).map((r) => ({
      ...(r.tag as object),
      source: r.source,
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.tag_id) {
    return NextResponse.json({ error: "Falta tag_id" }, { status: 400 })
  }

  const { error } = await supabase
    .from("crm_contact_tags")
    .insert({ contact_id: id, tag_id: body.tag_id, source: "manual" })

  // 23505 = already applied → treat as success
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.tag_id) {
    return NextResponse.json({ error: "Falta tag_id" }, { status: 400 })
  }

  const { error } = await supabase
    .from("crm_contact_tags")
    .delete()
    .eq("contact_id", id)
    .eq("tag_id", body.tag_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

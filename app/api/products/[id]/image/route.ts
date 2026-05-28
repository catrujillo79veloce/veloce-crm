import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadBytesToStorage } from "@/lib/integrations/media-storage"

// ---------------------------------------------------------------------------
// POST /api/products/[id]/image  (multipart: file)
// Uploads a product photo to Storage and sets crm_products.image_url.
// ---------------------------------------------------------------------------

export const maxDuration = 30
const MAX_BYTES = 8 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const form = await request.formData()
  const file = form.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 8 MB" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { url } = await uploadBytesToStorage({
      supabase: admin,
      bytes,
      contactId: `product-${id}`,
      mime: file.type,
      filename: file.name,
    })

    const { error } = await supabase
      .from("crm_products")
      .update({ image_url: url })
      .eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (e) {
    console.error("[Product Image] Failed:", e)
    return NextResponse.json({ error: "Error subiendo la imagen" }, { status: 500 })
  }
}

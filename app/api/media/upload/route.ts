import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadBytesToStorage, kindFromMime } from "@/lib/integrations/media-storage"

// ---------------------------------------------------------------------------
// POST /api/media/upload  (multipart: file, contactId)
// Uploads an attachment to Storage and returns a public URL for sending.
// ---------------------------------------------------------------------------

export const maxDuration = 30

const MAX_BYTES = 16 * 1024 * 1024 // 16 MB (WhatsApp limit for most media)

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const form = await request.formData()
  const file = form.get("file") as File | null
  const contactId = (form.get("contactId") as string) || "outbound"

  if (!file) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera 16 MB" },
      { status: 400 }
    )
  }

  const mime = file.type || "application/octet-stream"
  const bytes = new Uint8Array(await file.arrayBuffer())

  try {
    const admin = createAdminClient()
    const { url } = await uploadBytesToStorage({
      supabase: admin,
      bytes,
      contactId,
      mime,
      filename: file.name,
    })
    return NextResponse.json({
      url,
      mime,
      kind: kindFromMime(mime),
      filename: file.name,
    })
  } catch (e) {
    console.error("[Media Upload] Failed:", e)
    return NextResponse.json({ error: "Error subiendo el archivo" }, { status: 500 })
  }
}

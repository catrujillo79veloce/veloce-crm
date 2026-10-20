// ---------------------------------------------------------------------------
// Product photos for the AI agent.
//
// The bot can only produce text, so when a customer asks for a photo it emits
// a marker — [FOTO: <nombre del producto>] — which we strip out of the reply
// and resolve to that product's stored image. The webhook then sends the clean
// text plus the real photo.
//
// Only products that actually HAVE an image are advertised to the bot (see
// catalog-context.ts), so it cannot promise a photo that does not exist. If the
// lookup still comes up empty we just send the text: the customer gets an
// answer, never a broken attachment.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin"

const PHOTO_MARKER = /\[FOTO:\s*([^\]]*)\]/gi

export interface PhotoRequest {
  /** The reply with the marker removed — this is what the customer reads. */
  text: string
  /** Product the bot wants to show, or null when it asked for no photo. */
  productName: string | null
}

/**
 * Split a bot reply into the text to send and the product whose photo was
 * requested. Extra markers are dropped: one photo per message keeps the
 * conversation readable and the send path simple.
 */
export function extractPhotoRequest(reply: string): PhotoRequest {
  let productName: string | null = null

  const stripped = reply.replace(PHOTO_MARKER, (_match, name: string) => {
    const candidate = String(name ?? "").trim()
    if (!productName && candidate) productName = candidate
    return ""
  })

  // Removing an inline marker can leave double spaces or orphan blank lines.
  const text = stripped
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return { text, productName }
}

export interface ProductPhoto {
  name: string
  imageUrl: string
}

/**
 * Whether Meta can actually deliver this image. WhatsApp only accepts JPEG and
 * PNG for image messages (WebP is sticker-only), so a .webp photo — what you
 * get when you save an image off a brand's website — would be rejected.
 *
 * Deliberately conservative: a URL we cannot classify counts as NOT sendable,
 * because a bot that promises a photo and sends nothing is worse than one that
 * offers to have an asesor send it. Uploads are normalized to JPEG, so this
 * only trips on externally imported URLs.
 */
export function isSendablePhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const path = url.split(/[?#]/)[0].toLowerCase()
  return /\.(jpg|jpeg|png)$/.test(path)
}

/** Postgres LIKE wildcards would otherwise come from the model's output. */
function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`)
}

/**
 * Find the image of an active product by name. Matches the exact name first,
 * then falls back to a contains match, because the model occasionally adds or
 * drops the brand ("Orca M30" vs "Orbea Orca M30").
 */
export async function findProductPhoto(
  name: string
): Promise<ProductPhoto | null> {
  const query = name.trim()
  if (!query) return null

  try {
    const supabase = createAdminClient()

    const base = () =>
      supabase
        .from("crm_products")
        .select("name, image_url")
        .eq("is_active", true)
        .not("image_url", "is", null)

    const exact = await base().ilike("name", escapeLikePattern(query)).limit(1)
    const hit =
      exact.data && exact.data.length > 0
        ? exact.data[0]
        : (
            await base()
              .ilike("name", `%${escapeLikePattern(query)}%`)
              .limit(1)
          ).data?.[0]

    if (!hit?.image_url || !isSendablePhotoUrl(String(hit.image_url))) {
      return null
    }
    return { name: String(hit.name), imageUrl: String(hit.image_url) }
  } catch (e) {
    console.error("[ProductPhoto] Lookup failed:", e)
    return null
  }
}

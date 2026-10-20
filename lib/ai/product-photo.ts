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

/**
 * Collapse a product name to comparable tokens: no accents, no case, no
 * punctuation, and no parentheticals — so "Indoor Cycling Veloce (clase
 * suelta)" and "indoor cycling veloce" line up.
 */
function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

interface Candidate {
  name: string
  imageUrl: string
}

/**
 * Pick the product the bot meant. The model does not always echo the catalog
 * name byte-for-byte — it drops or adds the brand ("Orca M30" for "Orbea Orca
 * M30", "Veloce Bike Fit Retul 3D" for "Bike Fit Retul 3D") — so exact-only
 * matching silently sends no photo after the bot already promised one.
 *
 * Ranks by how close the token sequences are and requires a single clear
 * winner: on a genuine tie ("Casco Kask" fits both Kask helmets) it returns
 * nothing, because sending the wrong product's photo is worse than sending
 * none.
 */
export function pickProductByName<T extends Candidate>(
  query: string,
  candidates: T[]
): T | null {
  const q = normalizeName(query)
  if (!q) return null

  // Spacing around model numbers is unreliable ("M-20", "M 20", "m20"), so
  // every tier is also tried with the spaces removed.
  const qCompact = q.replace(/ /g, "")

  const scored = candidates
    .map((c) => {
      const n = normalizeName(c.name)
      if (!n) return null
      const nCompact = n.replace(/ /g, "")

      let score: number
      if (n === q) score = 1000
      else if (nCompact === qCompact) score = 900
      else if (n.includes(q) || q.includes(n)) score = 500
      else if (nCompact.includes(qCompact) || qCompact.includes(nCompact)) {
        score = 400
      } else {
        // Every word the bot gave us has to appear in the product name,
        // otherwise it is talking about something else.
        const nTokens = new Set(n.split(" "))
        if (!q.split(" ").every((t) => nTokens.has(t))) return null
        score = 100
      }

      return { candidate: c, score }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  if (scored.length === 0) return null

  // A single clear winner only. "Casco Kask" fits both Kask helmets and
  // "Colnago V3" fits both Colnagos — there the bot has not said which one it
  // means, and sending the wrong product's photo is worse than sending none.
  const topScore = Math.max(...scored.map((s) => s.score))
  const winners = scored.filter((s) => s.score === topScore)
  return winners.length === 1 ? winners[0].candidate : null
}

/**
 * Find the stored image of an active product the bot asked to show. Returns
 * null when there is no match, no photo, or the photo is in a format Meta
 * refuses to deliver — the caller then just sends the text.
 */
export async function findProductPhoto(
  name: string
): Promise<ProductPhoto | null> {
  if (!name.trim()) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("crm_products")
      .select("name, image_url")
      .eq("is_active", true)
      .not("image_url", "is", null)

    if (error || !data) return null

    const candidates: Candidate[] = data
      .filter((p) => isSendablePhotoUrl(p.image_url as string | null))
      .map((p) => ({ name: String(p.name), imageUrl: String(p.image_url) }))

    return pickProductByName(name, candidates)
  } catch (e) {
    console.error("[ProductPhoto] Lookup failed:", e)
    return null
  }
}

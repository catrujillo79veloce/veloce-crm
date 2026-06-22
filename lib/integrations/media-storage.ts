// ---------------------------------------------------------------------------
// Media storage — download from Meta and persist to Supabase Storage
//
// Meta's media URLs are short-lived:
//   - WhatsApp Cloud API:   ~5 minutes
//   - Instagram / Messenger: ~1 hour
//
// If we just stored the Meta URL, every image/audio in the inbox would 404
// after a few minutes. So when a media message arrives we:
//   1. Fetch the binary from Meta (with auth header for WhatsApp)
//   2. Upload it to the Supabase Storage bucket "crm-media"
//   3. Return the permanent public URL for embedding in the UI
// ---------------------------------------------------------------------------

import { randomUUID } from "crypto"
import type { createAdminClient } from "@/lib/supabase/admin"

const STORAGE_BUCKET = "crm-media"

export type MediaKind = "image" | "audio" | "video" | "document" | "sticker"

interface StoreResult {
  url: string
  storagePath: string
  /**
   * The TRUE media type, resolved from the file's magic bytes — not the hint
   * the caller passed in. Meta mislabels shared reels / video story-replies as
   * `image` attachments, so trust this, not the webhook's attachment type.
   */
  mime: string
  kind: MediaKind
}

interface StoreParams {
  supabase: ReturnType<typeof createAdminClient>
  /** URL returned by Meta (Graph API). Must be downloaded within minutes. */
  metaUrl: string
  /**
   * Auth header value for the download. WhatsApp returns URLs that REQUIRE
   * `Authorization: Bearer <token>` to download. IG/FB URLs are pre-signed
   * and don't need it — pass undefined in those cases.
   */
  bearerToken?: string
  contactId: string
  kind: MediaKind
  /** MIME type from the webhook payload, e.g. "image/jpeg". */
  mime: string
  /** Optional original filename (documents); auto-generated otherwise. */
  filename?: string
}

/**
 * Download a media file from Meta and upload it to Supabase Storage.
 * Returns the permanent public URL. Throws on failure (caller decides whether
 * to swallow and continue, or surface the error).
 */
export async function downloadAndStore(
  params: StoreParams
): Promise<StoreResult> {
  const { supabase, metaUrl, bearerToken, contactId, kind, mime, filename } =
    params

  // --- Download from Meta ---
  const headers: Record<string, string> = {}
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`

  const downloadResp = await fetch(metaUrl, { headers })
  if (!downloadResp.ok) {
    throw new Error(
      `[MediaStorage] Failed to download from Meta: ${downloadResp.status} ${downloadResp.statusText}`
    )
  }
  const blob = await downloadResp.arrayBuffer()
  const bytes = new Uint8Array(blob)

  // --- Resolve the REAL media type from the bytes ---
  // Meta labels shared reels and video story-replies as `image` attachments,
  // but payload.url is actually an MP4. Sniffing the magic bytes (falling back
  // to the HTTP Content-Type, then the caller's hint) stops us storing a video
  // as image/jpeg and feeding it to the image-only vision API.
  const headerMime = (downloadResp.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase()
  const sniffed = sniffMimeFromBytes(bytes)
  let resolvedMime: string
  let resolvedKind: MediaKind
  if (kind === "audio") {
    // Audio containers (m4a/mp4) can sniff as video — never downgrade audio,
    // or we'd skip transcription for a voice note.
    resolvedKind = "audio"
    resolvedMime =
      sniffed && sniffed.startsWith("audio/")
        ? sniffed
        : isConcreteMime(headerMime) && headerMime.startsWith("audio/")
          ? headerMime
          : mime
  } else {
    resolvedMime = sniffed ?? (isConcreteMime(headerMime) ? headerMime : mime)
    resolvedKind = kindFromMime(resolvedMime)
  }

  // --- Build a storage path: contactId/yyyymmdd-uuid.ext ---
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const ext = pickExtension(resolvedMime, filename)
  const safeName = filename
    ? filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")
    : `${kind}-${randomUUID()}${ext}`
  const storagePath = `${contactId}/${today}-${randomUUID().slice(0, 8)}-${safeName}`

  // --- Upload ---
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: resolvedMime,
      upsert: false,
    })
  if (upErr) {
    throw new Error(`[MediaStorage] Upload failed: ${upErr.message}`)
  }

  // --- Public URL ---
  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

  return { url: publicUrl, storagePath, mime: resolvedMime, kind: resolvedKind }
}

// ---------------------------------------------------------------------------
// Magic-byte sniffing — identify a file by its leading bytes.
//
// Meta mislabels shared reels / video story-replies as `image` attachments, so
// the attachment "type" in the webhook can't be trusted. Returns null when the
// signature isn't recognized (caller falls back to the hinted mime).
// ---------------------------------------------------------------------------

export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length < 12) return null

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png"
  // GIF: 47 49 46 38 ("GIF8")
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif"
  // WEBP: "RIFF"...."WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp"
  // ISO Base Media (MP4/MOV/M4A): bytes 4-7 = "ftyp"
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    // Audio-only brands keep an audio mime; everything else is video.
    if (brand.startsWith("M4A") || brand.startsWith("M4B")) return "audio/mp4"
    return "video/mp4"
  }
  // OGG: "OggS"
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53)
    return "audio/ogg"
  // MP3: "ID3" tag
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio/mpeg"
  // PDF: "%PDF"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return "application/pdf"

  return null
}

/** True when a Content-Type header is specific enough to trust. */
function isConcreteMime(mime: string): boolean {
  return (
    !!mime &&
    mime !== "application/octet-stream" &&
    mime !== "binary/octet-stream" &&
    mime.includes("/")
  )
}

// ---------------------------------------------------------------------------
// Upload raw bytes (e.g. a file the agent attaches from the CRM) to Storage.
// ---------------------------------------------------------------------------

export async function uploadBytesToStorage(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  bytes: Uint8Array
  contactId: string
  mime: string
  filename?: string
}): Promise<StoreResult> {
  const { supabase, bytes, contactId, mime, filename } = params
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const ext = pickExtension(mime, filename)
  const safeName = filename
    ? filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")
    : `outbound-${randomUUID()}${ext}`
  const storagePath = `${contactId}/out-${today}-${randomUUID().slice(0, 8)}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false })
  if (upErr) {
    throw new Error(`[MediaStorage] Upload failed: ${upErr.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

  return { url: publicUrl, storagePath, mime, kind: kindFromMime(mime) }
}

/** Infer a coarse media kind from a MIME type. */
export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  return "document"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
}

function pickExtension(mime: string, filename?: string): string {
  if (filename && filename.includes(".")) {
    return filename.slice(filename.lastIndexOf("."))
  }
  return MIME_TO_EXT[mime] ?? ".bin"
}

/**
 * Fetch the actual download URL for a WhatsApp media ID. The webhook only
 * gives you an ID; you must hit the Graph API to get the temporary URL.
 *
 * Returns null if the lookup fails so the caller can fall back gracefully.
 */
export async function getWhatsAppMediaUrl(
  mediaId: string
): Promise<{ url: string; mime: string; sha256?: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) {
    console.error("[MediaStorage] WHATSAPP_ACCESS_TOKEN missing")
    return null
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) {
      console.error("[MediaStorage] WA media lookup failed:", resp.status)
      return null
    }
    const json = (await resp.json()) as {
      url?: string
      mime_type?: string
      sha256?: string
    }
    if (!json.url || !json.mime_type) return null
    return { url: json.url, mime: json.mime_type, sha256: json.sha256 }
  } catch (e) {
    console.error("[MediaStorage] WA media lookup exception:", e)
    return null
  }
}

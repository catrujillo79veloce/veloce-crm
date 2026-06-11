// Instagram Business Login API (IGAA tokens) requires graph.instagram.com.
// Facebook-page-based access (EAA tokens) used graph.facebook.com — kept here
// only to document why this differs from facebook.ts / whatsapp.ts.
const GRAPH_API_VERSION = "v22.0"
const GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`

// ---------------------------------------------------------------------------
// Send an Instagram Direct message via the Graph API
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean
  error?: string
  errorCode?: number | string
}

export async function sendInstagramMessage(
  recipientId: string,
  message: string,
  options?: { humanAgent?: boolean }
): Promise<SendResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN

  if (!accessToken) {
    console.error("[Instagram] Missing INSTAGRAM_ACCESS_TOKEN")
    return { ok: false, error: "Credenciales de Instagram no configuradas" }
  }

  // The HUMAN_AGENT tag extends the messaging window from 24h to 7 days for a
  // real person responding to a customer. Only used for manual replies from
  // the CRM — never for automated bot replies (Meta policy).
  const payload: Record<string, unknown> = {
    recipient: { id: recipientId },
    message: { text: message },
  }
  if (options?.humanAgent) {
    payload.messaging_type = "MESSAGE_TAG"
    payload.tag = "HUMAN_AGENT"
  }

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const raw = await response.text()
      console.error("[Instagram] Send failed:", response.status, raw)
      return { ok: false, ...parseInstagramError(raw, response.status) }
    }

    console.log("[Instagram] Message sent to:", recipientId)
    return { ok: true }
  } catch (error) {
    console.error("[Instagram] Send message exception:", error)
    return { ok: false, error: "Error de red contactando a Instagram" }
  }
}

// ---------------------------------------------------------------------------
// Send a media attachment (image / audio / video) by public URL.
// ---------------------------------------------------------------------------

export async function sendInstagramMedia(
  recipientId: string,
  type: "image" | "audio" | "video",
  url: string
): Promise<SendResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: false, error: "Credenciales de Instagram no configuradas" }
  }
  try {
    const apiUrl = `${GRAPH_API_BASE}/me/messages`
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { attachment: { type, payload: { url } } },
      }),
    })
    if (!response.ok) {
      const raw = await response.text()
      console.error("[Instagram] Media send failed:", response.status, raw)
      return { ok: false, ...parseInstagramError(raw, response.status) }
    }
    return { ok: true }
  } catch (error) {
    console.error("[Instagram] Media send exception:", error)
    return { ok: false, error: "Error de red contactando a Instagram" }
  }
}

function parseInstagramError(
  raw: string,
  status: number
): { error: string; errorCode?: number | string } {
  try {
    const json = JSON.parse(raw)
    const code = json?.error?.code
    const subcode = json?.error?.error_subcode
    const message: string = json?.error?.message ?? ""

    // Outside the 24h messaging window (Instagram policy). Meta only lets you
    // reply for free within 24h of the customer's last DM. After that you must
    // wait for them to write again (or contact them by WhatsApp/phone).
    if ((code === 10 && /policy|window/i.test(message)) || /allowed window/i.test(message)) {
      return {
        errorCode: code,
        error:
          "Pasaron mas de 24h desde el ultimo DM del cliente. Instagram solo deja responder dentro de esa ventana — espera a que el cliente escriba de nuevo o contactalo por WhatsApp/llamada.",
      }
    }
    // Token issues
    if (code === 190 || subcode === 463 || subcode === 467) {
      return {
        errorCode: code,
        error: "Token de Instagram expirado. Renuevalo en Meta Business.",
      }
    }
    // User not found / can't message
    if (code === 100 || code === 551) {
      return {
        errorCode: code,
        error: "No se puede enviar a este usuario (cuenta inaccesible o invalida).",
      }
    }
    // Missing permissions
    if (code === 200) {
      return {
        errorCode: code,
        error:
          "Faltan permisos del token (instagram_business_manage_messages).",
      }
    }
    if (message) {
      return { errorCode: code, error: `Meta: ${message}` }
    }
    return { error: `HTTP ${status} desde Meta` }
  } catch {
    return { error: `HTTP ${status} desde Meta` }
  }
}

// ---------------------------------------------------------------------------
// Parse incoming Instagram messaging webhook payload
// ---------------------------------------------------------------------------

export type IGMediaKind = "image" | "audio" | "video" | "document" | "sticker"

/**
 * Ad attribution for Messenger-platform channels (IG / FB). Normalized to the
 * same shape used by the WhatsApp parser so the UI can render one banner.
 */
export interface MessengerReferral {
  source_type: string // "ad" | "post" | "ref"
  source_id?: string // ad_id
  source_url?: string
  headline?: string // ads_context_data.ad_title
  body?: string
  image_url?: string // ads_context_data.photo_url
  video_url?: string
  ref?: string
}

/**
 * Extract + normalize the referral object from a Messenger-platform webhook
 * event. It can ride on the message (CTM/CTD ads opening a new thread), on a
 * postback, or as a standalone messaging_referrals event.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMessengerReferral(event: any): MessengerReferral | undefined {
  const r = event?.message?.referral ?? event?.postback?.referral ?? event?.referral
  if (!r || typeof r !== "object") return undefined
  const ads = r.ads_context_data ?? {}
  const referral: MessengerReferral = {
    source_type:
      typeof r.source === "string" ? r.source.toLowerCase() : "ad",
  }
  if (typeof r.ad_id === "string") referral.source_id = r.ad_id
  if (typeof r.ref === "string") referral.ref = r.ref
  if (typeof ads.ad_title === "string") referral.headline = ads.ad_title
  if (typeof ads.photo_url === "string") referral.image_url = ads.photo_url
  if (typeof ads.video_url === "string") referral.video_url = ads.video_url
  // Nothing useful extracted → treat as absent
  if (!referral.source_id && !referral.headline && !referral.ref) return undefined
  return referral
}

export interface ParsedInstagramMessage {
  senderId: string
  /** Text body, or empty when the message is media-only. */
  message: string
  messageId: string
  timestamp: number
  /** First attachment, if any. IG/FB include the download URL inline. */
  media?: {
    url: string
    kind: IGMediaKind
    /** IG/FB don't send mime — we infer from URL or default to a sensible guess. */
    mime: string
  }
  /** Present when the user arrived from a Click-to-Instagram-Direct ad. */
  referral?: MessengerReferral
}

export function parseInstagramWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): ParsedInstagramMessage[] {
  const messages: ParsedInstagramMessage[] = []

  try {
    const entries = body?.entry ?? []
    for (const entry of entries) {
      const messagingEvents = entry?.messaging ?? []

      for (const event of messagingEvents) {
        // Standalone referral/postback events (messaging_referral webhook):
        // the user clicked an ad into an existing thread, so the referral
        // arrives WITHOUT a message. Emit a referral-only entry so the route
        // can attach the pauta to the contact + conversation.
        if (!event.message) {
          const referral = normalizeMessengerReferral(event)
          if (!referral) continue // reads, reactions, deliveries, etc.
          const senderId = event.sender?.id ?? ""
          if (!senderId) continue
          messages.push({
            senderId,
            message: "",
            messageId: `igref-${senderId}-${event.timestamp ?? 0}`,
            timestamp: event.timestamp ?? Date.now(),
            referral,
          })
          continue
        }

        // Skip echo messages (messages sent by the page itself)
        if (event.message.is_echo) continue

        const text: string | null = event.message.text ?? null
        const attachments = event.message.attachments ?? []
        const media = extractFirstAttachment(attachments)

        if (!text && !media) continue

        messages.push({
          senderId: event.sender?.id ?? "",
          message: text ?? "",
          messageId: event.message.mid ?? "",
          timestamp: event.timestamp ?? Date.now(),
          media,
          referral: normalizeMessengerReferral(event),
        })
      }
    }
  } catch (error) {
    console.error("[Instagram] Parse webhook error:", error)
  }

  return messages
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFirstAttachment(attachments: any[]):
  | { url: string; kind: IGMediaKind; mime: string }
  | undefined {
  for (const att of attachments ?? []) {
    const url: string | undefined = att?.payload?.url
    if (!url) continue
    const kind = normalizeAttachmentKind(att.type)
    if (!kind) continue
    return { url, kind, mime: inferMime(url, kind) }
  }
  return undefined
}

function normalizeAttachmentKind(type: string | undefined): IGMediaKind | null {
  switch (type) {
    case "image":
      return "image"
    case "audio":
      return "audio"
    case "video":
      return "video"
    case "file":
      return "document"
    case "story_mention":
    case "share":
      return "image" // treat as image — payload.url is a snapshot
    default:
      return null
  }
}

function inferMime(url: string, kind: IGMediaKind): string {
  const lower = url.toLowerCase().split("?")[0]
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".mp4")) return kind === "audio" ? "audio/mp4" : "video/mp4"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".pdf")) return "application/pdf"
  // Fallback by kind
  if (kind === "image") return "image/jpeg"
  if (kind === "audio") return "audio/mp4"
  if (kind === "video") return "video/mp4"
  return "application/octet-stream"
}

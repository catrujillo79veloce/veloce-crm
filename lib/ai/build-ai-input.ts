// ---------------------------------------------------------------------------
// Build the input string we feed to the bot when a customer sends media.
//
// Customers don't always type text — they send a voice note, a photo of a
// damaged wheel, or a screenshot. The bot only handles strings, so we
// concatenate any available content (text, caption, transcription, vision
// caption) into a single prompt that gives the bot the context it needs.
//
// Returns null when there's nothing to respond to (e.g. an unsupported
// attachment we couldn't transcribe or caption).
// ---------------------------------------------------------------------------

export interface BuildAIInputParams {
  text?: string | null
  caption?: string | null
  transcription?: string | null
  visionCaption?: string | null
  mediaType?: string | null
}

export function buildAIInput(params: BuildAIInputParams): string | null {
  const { text, caption, transcription, visionCaption, mediaType } = params
  const parts: string[] = []
  if (text) parts.push(text)
  if (caption) parts.push(caption)
  if (transcription) parts.push(`[Audio del cliente]: ${transcription}`)
  if (visionCaption) parts.push(`[Imagen que envio el cliente]: ${visionCaption}`)
  if (parts.length === 0 && mediaType) {
    parts.push(mediaPlaceholder(mediaType))
  }
  return parts.length ? parts.join("\n") : null
}

/**
 * Human-readable version of the same content, for the operator's alerts and
 * for buying-intent detection.
 *
 * These two used to be fed the raw `text` field alone, which is empty for
 * every voice note, photo and video — so the phone alert arrived blank and the
 * hot-lead detector never fired on media. A voice note saying "quiero separar
 * la Orbea" produced no 🔥 and a notification with nothing in the body.
 */
export function describeInbound(params: BuildAIInputParams): string {
  const { text, caption, transcription, visionCaption, mediaType } = params
  const parts: string[] = []
  if (text) parts.push(text)
  if (caption) parts.push(caption)
  if (transcription) parts.push(`🎤 "${transcription}"`)
  if (visionCaption) parts.push(`📷 ${visionCaption}`)
  if (parts.length === 0) {
    switch (mediaType) {
      case "video":
        return "🎬 Envió un video"
      case "image":
        return "📷 Envió una foto"
      case "sticker":
        return "😀 Envió un sticker"
      case "audio":
        return "🎤 Envió una nota de voz (no se pudo transcribir)"
      case "document":
        return "📄 Envió un documento"
      default:
        return mediaType ? `Envió un archivo (${mediaType})` : "Mensaje nuevo"
    }
  }
  return parts.join(" — ")
}

/**
 * Note for the bot when a customer sends media we couldn't turn into text.
 * Keep it instructive (tell the bot what to DO) so it never flatly answers
 * "no puedo ver imágenes" — especially for shared reels/stories, which are
 * videos, not images.
 */
function mediaPlaceholder(mediaType: string): string {
  switch (mediaType) {
    case "video":
      return "[El cliente compartio un video (posiblemente un reel o una historia de Instagram). No puedes verlo; preguntale amablemente de que se trata o en que puedes ayudarle.]"
    case "image":
    case "sticker":
      return "[El cliente envio una imagen que no se pudo procesar. Pidele amablemente que la describa o la reenvie.]"
    case "audio":
      return "[El cliente envio un audio que no se pudo transcribir. Pidele que escriba su mensaje.]"
    default:
      return `[El cliente envio un archivo de tipo ${mediaType} que no puedes abrir. Preguntale en que puedes ayudarle.]`
  }
}

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
    parts.push(`[El cliente envio un archivo de tipo ${mediaType} sin texto]`)
  }
  return parts.length ? parts.join("\n") : null
}

// ---------------------------------------------------------------------------
// Image captioning via Claude vision
//
// Takes the URL of an image the customer sent and returns a 1-2 sentence
// Spanish description so the AI agent has context to respond to image-only
// messages ("una foto de una bicicleta de ruta con marco rojo, marca Orbea").
//
// Falls back gracefully when the call fails — the message still saves, just
// without the caption.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface VisionParams {
  /** Public image URL (Supabase Storage). */
  imageUrl: string
  /** MIME type — needed for the API source.media_type field. */
  mime: string
}

const SYSTEM = `Eres un asistente que describe imagenes enviadas a una tienda de bicicletas (Veloce, Medellin). Describe la imagen en UNA O DOS oraciones cortas en espanol. Enfoca lo relevante: si es una bici, di marca/modelo si lo identificas, color, componentes visibles, talla aproximada. Si es una parte (rueda, cadena, sillin) describe el problema visible. Si es un screenshot, transcribe lo importante. Si es una persona montando, descripcion corta de la situacion. NO te disculpes, NO digas "veo una imagen", solo describe.`

export async function captionImage(
  params: VisionParams
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[Vision] ANTHROPIC_API_KEY missing — skipping caption")
    return null
  }

  // Anthropic only accepts certain image MIME types
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowed.includes(params.mime)) {
    console.log("[Vision] Unsupported mime, skipping:", params.mime)
    return null
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: params.imageUrl,
              },
            },
            {
              type: "text",
              text: "Describe esta imagen.",
            },
          ],
        },
      ],
    })

    const block = response.content.find((b) => b.type === "text")
    const text = (block as { text?: string } | undefined)?.text?.trim()
    if (!text) return null
    console.log(`[Vision] Caption: "${text.slice(0, 80)}..."`)
    return text
  } catch (e) {
    console.error("[Vision] Caption failed:", e)
    return null
  }
}

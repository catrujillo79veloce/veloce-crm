// ---------------------------------------------------------------------------
// Audio transcription via OpenAI Whisper
//
// We use whisper-1, which handles Spanish very well and is cheap (~$0.006/min).
// If OPENAI_API_KEY is not set, we return null and the caller falls back to
// rendering the audio without a transcription.
// ---------------------------------------------------------------------------

const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions"

interface TranscribeOptions {
  /** Public URL of the audio file (e.g. Supabase Storage). */
  audioUrl: string
  /** MIME type, e.g. "audio/ogg". Used to pick a filename for the form upload. */
  mime: string
  /** Hint for Whisper. Defaults to "es" (Spanish). Set to null for auto-detect. */
  language?: string | null
  /** Optional context-priming prompt (e.g. shop name, brand list) for accuracy. */
  prompt?: string
}

const DEFAULT_PROMPT =
  "Esta es una nota de voz para Veloce, una tienda de bicicletas en Medellin. " +
  "Marcas frecuentes: Orbea, BMC, Cervelo, Chapter 2, GW, Shimano, SRAM, " +
  "Wahoo, Pirelli, Maxxis. Servicios: mantenimiento, bike fit, taller, " +
  "entrenamiento indoor cycling, Zwift."

export async function transcribeAudio(
  opts: TranscribeOptions
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn(
      "[Transcribe] OPENAI_API_KEY not set — skipping transcription"
    )
    return null
  }

  try {
    // 1. Fetch the audio bytes from the public URL
    const audioResp = await fetch(opts.audioUrl)
    if (!audioResp.ok) {
      console.error(
        "[Transcribe] Failed to fetch audio:",
        audioResp.status,
        opts.audioUrl
      )
      return null
    }
    const audioBlob = await audioResp.blob()

    // 2. Build multipart form with the audio + parameters
    const form = new FormData()
    const filename = `voice${pickExt(opts.mime)}`
    form.append("file", audioBlob, filename)
    form.append("model", "whisper-1")
    form.append("language", opts.language ?? "es")
    form.append("prompt", opts.prompt ?? DEFAULT_PROMPT)
    form.append("response_format", "text")

    // 3. Call Whisper
    const resp = await fetch(WHISPER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error("[Transcribe] Whisper failed:", resp.status, errText)
      return null
    }

    // response_format=text returns the raw transcription string
    const text = await resp.text()
    const cleaned = text.trim()
    console.log(
      `[Transcribe] OK — ${cleaned.length} chars from ${opts.audioUrl.slice(0, 60)}...`
    )
    return cleaned || null
  } catch (e) {
    console.error("[Transcribe] Exception:", e)
    return null
  }
}

function pickExt(mime: string): string {
  if (mime.includes("ogg")) return ".ogg"
  if (mime.includes("mpeg")) return ".mp3"
  if (mime.includes("mp4")) return ".m4a"
  if (mime.includes("wav")) return ".wav"
  if (mime.includes("webm")) return ".webm"
  return ".bin"
}

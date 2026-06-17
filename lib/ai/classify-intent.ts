// ---------------------------------------------------------------------------
// Intent classifier — labels an inbound message with one of 8 canonical tags
// so the inbox can be filtered and prioritized at a glance.
//
// Implementation detail: a single Claude haiku call. Cheap (~$0.0003 per
// classification), fast (~400ms), and returns a JSON object so we can also
// surface confidence. Falls back to null on any failure — the message
// still saves, it just won't get a tag.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk"
import { INTENT_MODEL } from "./models"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const INTENT_TAGS = [
  "interes_compra",
  "separar_bici",
  "agendar_visita",
  "mantenimiento",
  "garantia",
  "queja",
  "info_tienda",
  "saludo",
] as const
export type IntentTag = (typeof INTENT_TAGS)[number]

interface ClassifyResult {
  intent: IntentTag
  confidence: number
}

const SYSTEM_PROMPT = `Eres un clasificador de intenciones para una tienda de bicicletas (Veloce, Medellin). Recibes un mensaje del cliente y devuelves UN SOLO objeto JSON con la intencion detectada.

CATEGORIAS POSIBLES (usa exactamente uno de estos nombres):
- interes_compra: pregunta por precio, disponibilidad o caracteristicas de una bici/producto concreto, indica intencion de comprar
- separar_bici: quiere apartar/reservar una bici, pregunta por abono, formas de pago para separar
- agendar_visita: quiere ir a la tienda, agendar bike fit, prueba de bici, asesoria presencial, pregunta por horarios para venir
- mantenimiento: necesita servicio de taller, mantenimiento, reparacion, ajuste, lavado, problema mecanico
- garantia: reclamo de garantia, defecto de fabrica, producto comprado con fallas
- queja: queja, problema sin resolver, demora, insatisfaccion
- info_tienda: pregunta generica por horarios, ubicacion, telefono, despachos, sin intencion clara de compra
- saludo: solo saluda, mensaje de cortesia sin contenido especifico

FORMATO DE SALIDA (estricto, solo JSON, sin markdown):
{"intent":"<categoria>","confidence":<0.0 a 1.0>}

EJEMPLOS:
Cliente: "Hola, cuanto vale la Orbea Terra H50?"
{"intent":"interes_compra","confidence":0.95}

Cliente: "Como hago para separar una bici, necesito que me digan el abono"
{"intent":"separar_bici","confidence":0.97}

Cliente: "A que hora abren los sabados?"
{"intent":"info_tienda","confidence":0.93}

Cliente: "Necesito un mantenimiento, la cadena hace ruido"
{"intent":"mantenimiento","confidence":0.96}

Cliente: "Hola"
{"intent":"saludo","confidence":0.99}`

export async function classifyIntent(
  text: string
): Promise<ClassifyResult | null> {
  if (!text || text.trim().length < 2) return null
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[Intent] ANTHROPIC_API_KEY missing — skipping classification")
    return null
  }

  try {
    const response = await anthropic.messages.create({
      model: INTENT_MODEL,
      max_tokens: 60,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: text.length > 800 ? text.slice(0, 800) : text,
        },
      ],
    })

    const block = response.content.find((b) => b.type === "text") as
      | { text?: string }
      | undefined
    const raw = block?.text?.trim() ?? ""
    if (!raw) return null

    // Strip code fences if the model emits them despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()

    const parsed = JSON.parse(cleaned) as ClassifyResult
    if (!INTENT_TAGS.includes(parsed.intent)) {
      console.warn("[Intent] Unknown intent returned:", parsed.intent)
      return null
    }
    const confidence = Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5

    return { intent: parsed.intent, confidence }
  } catch (e) {
    console.error("[Intent] Classification failed:", e)
    return null
  }
}

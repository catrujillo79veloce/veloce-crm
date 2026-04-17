// ---------------------------------------------------------------------------
// Hot message detector
// Analyzes incoming messages for buying-intent keywords and sends alerts
// ---------------------------------------------------------------------------

import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp"

// Keywords grouped by intensity
const HOT_KEYWORDS = {
  very_hot: [
    "quiero comprar",
    "quiero pagar",
    "voy a comprar",
    "me la llevo",
    "te compro",
    "dame tu cuenta",
    "consignar",
    "consignación",
    "transferir",
    "pago ya",
    "separar",
    "reservar",
    "apartar",
  ],
  hot: [
    "cuánto cuesta",
    "cuanto cuesta",
    "cuánto vale",
    "cuanto vale",
    "cuál es el precio",
    "cual es el precio",
    "precio de",
    "qué precio",
    "que precio",
    "tienen stock",
    "hay disponible",
    "tienen disponible",
    "está disponible",
    "cuándo puedo ir",
    "cuando puedo ir",
    "estoy interesado",
    "me interesa",
    "quiero ver",
    "agendar",
    "cita",
    "cotización",
    "cotizar",
    "financiación",
    "financiamiento",
    "crédito",
    "cuotas",
    "descuento",
    "promoción",
    "promo",
    "oferta",
  ],
}

export interface HotDetection {
  isHot: boolean
  intensity: "very_hot" | "hot" | null
  matchedKeyword: string | null
}

/**
 * Detect if a message shows buying intent.
 * Returns the intensity level and which keyword matched.
 */
export function detectHotMessage(text: string): HotDetection {
  if (!text) return { isHot: false, intensity: null, matchedKeyword: null }

  const normalized = text.toLowerCase().trim()

  // Check very_hot first (highest priority)
  for (const kw of HOT_KEYWORDS.very_hot) {
    if (normalized.includes(kw)) {
      return { isHot: true, intensity: "very_hot", matchedKeyword: kw }
    }
  }

  for (const kw of HOT_KEYWORDS.hot) {
    if (normalized.includes(kw)) {
      return { isHot: true, intensity: "hot", matchedKeyword: kw }
    }
  }

  return { isHot: false, intensity: null, matchedKeyword: null }
}

/**
 * Send hot alert to admin via WhatsApp.
 * Returns true if sent successfully.
 */
export async function sendHotAlert(params: {
  adminPhone: string
  contactName: string
  contactId: string
  channel: "whatsapp" | "instagram" | "facebook"
  message: string
  detection: HotDetection
  crmBaseUrl?: string
}): Promise<boolean> {
  const {
    adminPhone,
    contactName,
    contactId,
    channel,
    message,
    detection,
    crmBaseUrl = "https://veloce-crm-ten.vercel.app",
  } = params

  if (!detection.isHot) return false

  const emoji = detection.intensity === "very_hot" ? "🔥🔥🔥" : "🔥"
  const label =
    detection.intensity === "very_hot" ? "LEAD MUY CALIENTE" : "LEAD CALIENTE"

  const channelEmoji = {
    whatsapp: "💬",
    instagram: "📸",
    facebook: "💙",
  }[channel]

  const alert = `${emoji} *${label}* ${emoji}

${channelEmoji} Canal: *${channel.toUpperCase()}*
👤 Cliente: *${contactName}*
💬 Mensaje: "${message.length > 200 ? message.slice(0, 200) + "..." : message}"

🎯 Palabra detectada: "${detection.matchedKeyword}"

Ver en CRM: ${crmBaseUrl}/contacts/${contactId}`

  try {
    return await sendWhatsAppMessage(adminPhone, alert)
  } catch (err) {
    console.error("[HotAlert] Send failed:", err)
    return false
  }
}

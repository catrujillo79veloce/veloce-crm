const GRAPH_API_VERSION = "v25.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// ---------------------------------------------------------------------------
// Send a plain text WhatsApp message via the Cloud API
// ---------------------------------------------------------------------------

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error("[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN")
    return false
  }

  try {
    // Strip + from phone number (Meta requires format like 573176354893)
    const cleanTo = to.replace(/\+/g, "")
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body: message },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("[WhatsApp] Send message failed:", response.status, err)
      return false
    }

    const data = await response.json()
    console.log("[WhatsApp] Message sent, id:", data.messages?.[0]?.id)
    return true
  } catch (error) {
    console.error("[WhatsApp] Send message exception:", error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Send a template message (for HSM / first-contact 24h window)
// ---------------------------------------------------------------------------

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[]
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error("[WhatsApp] Missing env vars for template send")
    return false
  }

  try {
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "es" },
          components: params.length > 0
            ? [
                {
                  type: "body",
                  parameters: params.map((p) => ({
                    type: "text",
                    text: p,
                  })),
                },
              ]
            : [],
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("[WhatsApp] Template send failed:", response.status, err)
      return false
    }

    return true
  } catch (error) {
    console.error("[WhatsApp] Template send exception:", error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Parse incoming WhatsApp webhook payload
// ---------------------------------------------------------------------------

export interface ParsedWhatsAppMessage {
  phone: string
  message: string
  messageId: string
  timestamp: string
  senderName?: string
}

export function parseWhatsAppWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): ParsedWhatsAppMessage[] {
  const messages: ParsedWhatsAppMessage[] = []

  try {
    const entries = body?.entry ?? []
    for (const entry of entries) {
      const changes = entry?.changes ?? []
      for (const change of changes) {
        if (change.field !== "messages") continue

        const value = change.value
        if (!value?.messages) continue

        const contacts = value.contacts ?? []
        const contactMap = new Map<string, string>()
        for (const c of contacts) {
          if (c.wa_id && c.profile?.name) {
            contactMap.set(c.wa_id, c.profile.name)
          }
        }

        for (const msg of value.messages) {
          // Only process text messages for now
          const text =
            msg.text?.body ??
            msg.button?.text ??
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            null

          if (!text) continue

          messages.push({
            phone: msg.from,
            message: text,
            messageId: msg.id,
            timestamp: msg.timestamp,
            senderName: contactMap.get(msg.from),
          })
        }
      }
    }
  } catch (error) {
    console.error("[WhatsApp] Parse webhook error:", error)
  }

  return messages
}

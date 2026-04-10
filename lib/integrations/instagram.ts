const GRAPH_API_VERSION = "v19.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// ---------------------------------------------------------------------------
// Send an Instagram Direct message via the Graph API
// ---------------------------------------------------------------------------

export async function sendInstagramMessage(
  recipientId: string,
  message: string
): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN

  if (!accessToken) {
    console.error("[Instagram] Missing INSTAGRAM_ACCESS_TOKEN")
    return false
  }

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("[Instagram] Send message failed:", response.status, err)
      return false
    }

    console.log("[Instagram] Message sent to:", recipientId)
    return true
  } catch (error) {
    console.error("[Instagram] Send message exception:", error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Parse incoming Instagram messaging webhook payload
// ---------------------------------------------------------------------------

export interface ParsedInstagramMessage {
  senderId: string
  message: string
  messageId: string
  timestamp: number
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
        // Only process messages (not reads, deliveries, etc.)
        if (!event.message) continue

        // Skip echo messages (messages sent by the page itself)
        if (event.message.is_echo) continue

        const text = event.message.text ?? null
        if (!text) continue

        messages.push({
          senderId: event.sender?.id ?? "",
          message: text,
          messageId: event.message.mid ?? "",
          timestamp: event.timestamp ?? Date.now(),
        })
      }
    }
  } catch (error) {
    console.error("[Instagram] Parse webhook error:", error)
  }

  return messages
}

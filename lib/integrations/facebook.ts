const GRAPH_API_VERSION = "v19.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// ---------------------------------------------------------------------------
// Send a Facebook Messenger message via the Graph API
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean
  error?: string
  errorCode?: number | string
}

export async function sendFacebookMessage(
  recipientId: string,
  message: string,
  options?: { humanAgent?: boolean }
): Promise<SendResult> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN

  if (!accessToken) {
    console.error("[Facebook] Missing FACEBOOK_PAGE_ACCESS_TOKEN")
    return { ok: false, error: "Credenciales de Facebook no configuradas" }
  }

  // Human replies use the HUMAN_AGENT tag (7-day window). Bot replies use the
  // standard RESPONSE type (24h window, always satisfied since bot replies are
  // triggered by an inbound message).
  const payload: Record<string, unknown> = options?.humanAgent
    ? {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "MESSAGE_TAG",
        tag: "HUMAN_AGENT",
      }
    : {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }

  try {
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const raw = await response.text()
      console.error("[Facebook] Send failed:", response.status, raw)
      return { ok: false, ...parseMessengerError(raw, response.status) }
    }

    console.log("[Facebook] Message sent to:", recipientId)
    return { ok: true }
  } catch (error) {
    console.error("[Facebook] Send message exception:", error)
    return { ok: false, error: "Error de red contactando a Messenger" }
  }
}

// ---------------------------------------------------------------------------
// Send a media attachment (image / audio / video / file) by public URL.
// ---------------------------------------------------------------------------

export async function sendFacebookMedia(
  recipientId: string,
  type: "image" | "audio" | "video" | "file",
  url: string
): Promise<SendResult> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: false, error: "Credenciales de Facebook no configuradas" }
  }
  try {
    const apiUrl = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { attachment: { type, payload: { url, is_reusable: true } } },
      }),
    })
    if (!response.ok) {
      const raw = await response.text()
      console.error("[Facebook] Media send failed:", response.status, raw)
      return { ok: false, ...parseMessengerError(raw, response.status) }
    }
    return { ok: true }
  } catch (error) {
    console.error("[Facebook] Media send exception:", error)
    return { ok: false, error: "Error de red contactando a Messenger" }
  }
}

function parseMessengerError(
  raw: string,
  status: number
): { error: string; errorCode?: number | string } {
  try {
    const json = JSON.parse(raw)
    const code = json?.error?.code
    const subcode = json?.error?.error_subcode
    const message: string = json?.error?.message ?? ""

    // Outside 24h messaging window
    if (code === 10 && subcode === 2018278) {
      return {
        errorCode: code,
        error:
          "Pasaron mas de 24h desde el ultimo mensaje del cliente. Messenger no permite enviar fuera de esa ventana sin etiqueta.",
      }
    }
    // Token issues
    if (code === 190 || subcode === 463 || subcode === 467) {
      return {
        errorCode: code,
        error: "Token de pagina de Facebook expirado. Renuevalo en Business Manager.",
      }
    }
    // Recipient unavailable / blocked the page
    if (code === 551 || subcode === 1545041) {
      return {
        errorCode: code,
        error: "El usuario bloqueo la pagina o su cuenta no esta disponible.",
      }
    }
    // PSID invalido (probablemente el facebook_id guardado esta mal — caso del bug de leadgen)
    if (code === 100 && /recipient/i.test(message)) {
      return {
        errorCode: code,
        error:
          "El facebook_id del contacto no corresponde a un usuario de Messenger.",
      }
    }
    // Missing permissions
    if (code === 200) {
      return {
        errorCode: code,
        error: "Faltan permisos del token de pagina (pages_messaging).",
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
// Fetch full lead data from a Facebook Lead Ads leadgen_id
// ---------------------------------------------------------------------------

export interface FacebookLeadData {
  id: string
  name: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  city: string | null
  custom_fields: Record<string, string>
}

export async function fetchLeadData(
  leadgenId: string
): Promise<FacebookLeadData | null> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN

  if (!accessToken) {
    console.error("[Facebook] Missing FACEBOOK_PAGE_ACCESS_TOKEN")
    return null
  }

  try {
    const url = `${GRAPH_API_BASE}/${leadgenId}?access_token=${accessToken}`
    const response = await fetch(url)

    if (!response.ok) {
      const err = await response.text()
      console.error("[Facebook] Fetch lead data failed:", response.status, err)
      return null
    }

    const data = await response.json()
    const fieldData: Array<{ name: string; values: string[] }> =
      data.field_data ?? []

    const fields = new Map<string, string>()
    const customFields: Record<string, string> = {}

    for (const field of fieldData) {
      const value = field.values?.[0] ?? ""
      fields.set(field.name.toLowerCase(), value)

      // Collect non-standard fields as custom
      if (
        !["full_name", "first_name", "last_name", "email", "phone_number", "city"].includes(
          field.name.toLowerCase()
        )
      ) {
        customFields[field.name] = value
      }
    }

    // Parse name - Facebook may provide full_name or first_name/last_name
    let firstName = fields.get("first_name") ?? ""
    let lastName = fields.get("last_name") ?? ""

    if (!firstName && !lastName) {
      const fullName = fields.get("full_name") ?? ""
      const parts = fullName.split(" ")
      firstName = parts[0] ?? ""
      lastName = parts.slice(1).join(" ")
    }

    return {
      id: leadgenId,
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      email: fields.get("email") || null,
      phone: fields.get("phone_number") || null,
      city: fields.get("city") || null,
      custom_fields: customFields,
    }
  } catch (error) {
    console.error("[Facebook] Fetch lead data exception:", error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Parse Facebook leadgen webhook payload
// ---------------------------------------------------------------------------

export interface ParsedLeadgenEvent {
  leadgenId: string
  pageId: string
  formId: string
  createdTime: number
}

export function parseLeadgenWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): ParsedLeadgenEvent[] {
  const events: ParsedLeadgenEvent[] = []

  try {
    const entries = body?.entry ?? []
    for (const entry of entries) {
      const pageId = entry.id ?? ""
      const changes = entry?.changes ?? []

      for (const change of changes) {
        if (change.field !== "leadgen") continue

        const value = change.value
        if (!value?.leadgen_id) continue

        events.push({
          leadgenId: value.leadgen_id,
          pageId,
          formId: value.form_id ?? "",
          createdTime: value.created_time ?? 0,
        })
      }
    }
  } catch (error) {
    console.error("[Facebook] Parse leadgen webhook error:", error)
  }

  return events
}

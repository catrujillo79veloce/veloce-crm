const GRAPH_API_VERSION = "v19.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

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

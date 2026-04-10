import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Rate limiting: in-memory store (max 5 submissions per IP per hour)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return true
  }

  return false
}

// Periodic cleanup to prevent memory leaks (run every 10 minutes)
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((entry, ip) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip)
    }
  })
}, 10 * 60 * 1000)

// ---------------------------------------------------------------------------
// Zod validation schema
// ---------------------------------------------------------------------------

const leadFormSchema = z.object({
  first_name: z.string().min(1, "El nombre es requerido").max(100),
  last_name: z.string().max(100).optional().default(""),
  email: z.string().email("Email no valido").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  interests: z.array(z.string()).optional().default([]),
  message: z.string().max(2000).optional().default(""),
  // UTM parameters
  utm_source: z.string().max(200).optional().or(z.literal("")),
  utm_medium: z.string().max(200).optional().or(z.literal("")),
  utm_campaign: z.string().max(200).optional().or(z.literal("")),
  // Honeypot field - must be empty
  website: z.string().max(0, "").optional().default(""),
})

// ---------------------------------------------------------------------------
// POST - Public lead form submission
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown"

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes. Intenta mas tarde." },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Honeypot check - if "website" field is filled, a bot submitted the form
    if (body.website && body.website.length > 0) {
      // Return success to not tip off the bot, but do nothing
      console.log("[LeadForm] Honeypot triggered from IP:", ip)
      return NextResponse.json({ success: true, message: "Gracias por tu interes." })
    }

    // Validate
    const parsed = leadFormSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Datos invalidos"
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Must have at least email or phone
    if (!data.email && !data.phone) {
      return NextResponse.json(
        { success: false, error: "Se requiere email o telefono" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // --- Create contact ---
    const contactInsert: Record<string, unknown> = {
      first_name: data.first_name.trim(),
      last_name: (data.last_name ?? "").trim(),
      source: "website_form",
      city: "Medellin",
      status: "active",
      interests: data.interests ?? [],
    }

    if (data.email) contactInsert.email = data.email.toLowerCase().trim()
    if (data.phone) {
      contactInsert.phone = normalizePhone(data.phone)
      contactInsert.whatsapp_phone = normalizePhone(data.phone)
    }
    if (data.utm_source) contactInsert.utm_source = data.utm_source
    if (data.utm_medium) contactInsert.utm_medium = data.utm_medium
    if (data.utm_campaign) contactInsert.utm_campaign = data.utm_campaign

    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .insert(contactInsert)
      .select("id")
      .single()

    if (contactError || !contact) {
      console.error("[LeadForm] Contact creation failed:", contactError)
      return NextResponse.json(
        { success: false, error: "Error al procesar tu solicitud" },
        { status: 500 }
      )
    }

    // --- Auto-assign via round-robin ---
    const assignedTo = await getNextRoundRobinMember(supabase)

    if (assignedTo) {
      await supabase
        .from("crm_contacts")
        .update({ assigned_to: assignedTo })
        .eq("id", contact.id)
    }

    // --- Create lead ---
    const { data: maxPosData } = await supabase
      .from("crm_leads")
      .select("position")
      .eq("status", "new")
      .order("position", { ascending: false })
      .limit(1)

    const nextPosition =
      maxPosData && maxPosData.length > 0 ? maxPosData[0].position + 1 : 0

    const interestsText =
      data.interests && data.interests.length > 0
        ? data.interests.join(", ")
        : ""

    const { error: leadError } = await supabase.from("crm_leads").insert({
      contact_id: contact.id,
      title: `Web Lead - ${data.first_name} ${data.last_name ?? ""}`.trim(),
      status: "new",
      priority: "medium",
      source: "website_form",
      assigned_to: assignedTo,
      position: nextPosition,
      score: 0,
    })

    if (leadError) {
      console.error("[LeadForm] Lead creation failed:", leadError)
    }

    // --- Create interaction ---
    const { error: interactionError } = await supabase
      .from("crm_interactions")
      .insert({
        contact_id: contact.id,
        type: "website_form",
        direction: "inbound",
        subject: "Lead Form Submission",
        body: [
          data.message ? `Mensaje: ${data.message}` : "",
          interestsText ? `Intereses: ${interestsText}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        channel_metadata: {
          platform: "website_form",
          utm_source: data.utm_source || null,
          utm_medium: data.utm_medium || null,
          utm_campaign: data.utm_campaign || null,
          ip_address: ip,
        },
        occurred_at: new Date().toISOString(),
      })

    if (interactionError) {
      console.error("[LeadForm] Interaction creation failed:", interactionError)
    }

    console.log("[LeadForm] Lead created:", contact.id, data.first_name)

    return NextResponse.json({
      success: true,
      message: "Gracias por tu interes. Te contactaremos pronto.",
    })
  } catch (error) {
    console.error("[LeadForm] Unexpected error:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Round-robin helper (same logic as Facebook webhook)
// ---------------------------------------------------------------------------

async function getNextRoundRobinMember(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const { data: members } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("is_active", true)

    if (!members || members.length === 0) return null

    const memberIds = members.map((m) => m.id)

    const { data: leadCounts } = await supabase
      .from("crm_leads")
      .select("assigned_to")
      .in("assigned_to", memberIds)
      .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"])

    const countMap = new Map<string, number>()
    for (const id of memberIds) {
      countMap.set(id, 0)
    }
    for (const lead of leadCounts ?? []) {
      if (lead.assigned_to) {
        countMap.set(lead.assigned_to, (countMap.get(lead.assigned_to) ?? 0) + 1)
      }
    }

    let minCount = Infinity
    let selectedId: string | null = null

    countMap.forEach((count, id) => {
      if (count < minCount) {
        minCount = count
        selectedId = id
      }
    })

    return selectedId
  } catch (error) {
    console.error("[LeadForm] Round-robin error:", error)
    return null
  }
}

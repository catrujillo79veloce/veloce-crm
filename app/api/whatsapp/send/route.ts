import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/integrations/whatsapp"
import { pauseAIForContact } from "@/lib/ai/should-reply"

// ---------------------------------------------------------------------------
// POST - Send outbound WhatsApp message (authenticated CRM users only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // --- Authenticate user ---
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    // Verify the user is an active team member
    const { data: teamMember } = await supabase
      .from("crm_team_members")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!teamMember) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para enviar mensajes" },
        { status: 403 }
      )
    }

    // --- Parse body ---
    const body = await request.json()
    const { contactId, message, mediaUrl, mediaKind, mediaMime, filename } = body
    const text = (message ?? "").trim()

    if (!contactId || (!text && !mediaUrl)) {
      return NextResponse.json(
        { success: false, error: "Se requiere contactId y mensaje o archivo" },
        { status: 400 }
      )
    }

    // --- Get contact's WhatsApp phone ---
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("id, whatsapp_phone, first_name, last_name")
      .eq("id", contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: "Contacto no encontrado" },
        { status: 404 }
      )
    }

    if (!contact.whatsapp_phone) {
      return NextResponse.json(
        { success: false, error: "El contacto no tiene numero de WhatsApp" },
        { status: 400 }
      )
    }

    // --- Send message (media or text) ---
    const phone = contact.whatsapp_phone.replace("+", "")
    const result = mediaUrl
      ? await sendWhatsAppMedia(
          phone,
          (mediaKind as "image" | "video" | "audio" | "document") ?? "document",
          mediaUrl,
          text || undefined,
          filename
        )
      : await sendWhatsAppMessage(phone, text)

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? "Error al enviar el mensaje por WhatsApp",
          errorCode: result.errorCode,
        },
        { status: 502 }
      )
    }

    // --- Create outbound interaction ---
    const { error: interactionError } = await supabase
      .from("crm_interactions")
      .insert({
        contact_id: contactId,
        type: "whatsapp_message",
        direction: "outbound",
        subject: null,
        body: text || (mediaUrl ? "" : ""),
        media_url: mediaUrl ?? null,
        media_type: mediaUrl ? (mediaKind ?? "document") : null,
        media_mime: mediaUrl ? (mediaMime ?? null) : null,
        team_member_id: teamMember.id,
        channel_metadata: {
          phone: contact.whatsapp_phone,
          sent_by: teamMember.id,
        },
        occurred_at: new Date().toISOString(),
      })

    if (interactionError) {
      console.error("[WhatsApp Send] Interaction creation failed:", interactionError)
      // Message was sent, so still return success
    }

    // --- AI takeover: a human just sent a message, so pause the bot ---
    // We need the admin client because RLS may not allow the team member
    // to update arbitrary contact rows directly.
    try {
      await pauseAIForContact(createAdminClient(), contactId)
    } catch (e) {
      console.error("[WhatsApp Send] AI pause failed:", e)
    }

    return NextResponse.json({
      success: true,
      message: "Mensaje enviado correctamente",
    })
  } catch (error) {
    console.error("[WhatsApp Send] Unexpected error:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

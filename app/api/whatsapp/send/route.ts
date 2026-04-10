import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp"

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
    const { contactId, message } = body

    if (!contactId || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: "Se requiere contactId y mensaje" },
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

    // --- Send message ---
    const sent = await sendWhatsAppMessage(
      contact.whatsapp_phone.replace("+", ""),
      message.trim()
    )

    if (!sent) {
      return NextResponse.json(
        { success: false, error: "Error al enviar el mensaje por WhatsApp" },
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
        body: message.trim(),
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

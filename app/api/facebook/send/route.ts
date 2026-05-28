import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendFacebookMessage, sendFacebookMedia } from "@/lib/integrations/facebook"
import { pauseAIForContact } from "@/lib/ai/should-reply"

// ---------------------------------------------------------------------------
// POST - Send outbound Facebook Messenger message (authenticated CRM users only)
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
    const { contactId, message, mediaUrl, mediaKind, mediaMime } = body
    const text = (message ?? "").trim()

    if (!contactId || (!text && !mediaUrl)) {
      return NextResponse.json(
        { success: false, error: "Se requiere contactId y mensaje o archivo" },
        { status: 400 }
      )
    }

    // --- Get contact's Facebook ID ---
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("id, facebook_id, first_name, last_name")
      .eq("id", contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: "Contacto no encontrado" },
        { status: 404 }
      )
    }

    if (!contact.facebook_id) {
      return NextResponse.json(
        { success: false, error: "El contacto no tiene Facebook ID" },
        { status: 400 }
      )
    }

    // --- Send message (media or text) ---
    let result
    if (mediaUrl) {
      const fbKind = (mediaKind as "image" | "audio" | "video" | "document") ?? "file"
      const attachType = fbKind === "document" ? "file" : fbKind
      result = await sendFacebookMedia(
        contact.facebook_id,
        attachType as "image" | "audio" | "video" | "file",
        mediaUrl
      )
      if (result.ok && text) {
        await sendFacebookMessage(contact.facebook_id, text)
      }
    } else {
      result = await sendFacebookMessage(contact.facebook_id, text)
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? "Error al enviar el mensaje por Messenger",
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
        type: "facebook_message",
        direction: "outbound",
        subject: null,
        body: text,
        media_url: mediaUrl ?? null,
        media_type: mediaUrl ? (mediaKind ?? "document") : null,
        media_mime: mediaUrl ? (mediaMime ?? null) : null,
        team_member_id: teamMember.id,
        channel_metadata: {
          facebook_id: contact.facebook_id,
          sent_by: teamMember.id,
        },
        occurred_at: new Date().toISOString(),
      })

    if (interactionError) {
      console.error("[Facebook Send] Interaction creation failed:", interactionError)
      // Message was sent, so still return success
    }

    // --- AI takeover ---
    try {
      await pauseAIForContact(createAdminClient(), contactId)
    } catch (e) {
      console.error("[Facebook Send] AI pause failed:", e)
    }

    return NextResponse.json({
      success: true,
      message: "Mensaje enviado correctamente",
    })
  } catch (error) {
    console.error("[Facebook Send] Unexpected error:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

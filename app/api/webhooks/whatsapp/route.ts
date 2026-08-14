import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignatureAny } from "@/lib/integrations/webhook-verify"
import { parseWhatsAppWebhook, sendWhatsAppMessage } from "@/lib/integrations/whatsapp"
import { normalizePhone } from "@/lib/utils"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"
import { notifyAdminOfNewMessage, alertAdminSystemFailure } from "@/lib/ai/notify-admin"
import { shouldAIReply } from "@/lib/ai/should-reply"
import {
  downloadAndStore,
  getWhatsAppMediaUrl,
} from "@/lib/integrations/media-storage"
import { transcribeAudio } from "@/lib/ai/transcribe"
import { captionImage } from "@/lib/ai/vision"
import { buildAIInput, describeInbound } from "@/lib/ai/build-ai-input"
import { classifyIntent } from "@/lib/ai/classify-intent"
import { applyIntentTag } from "@/lib/ai/apply-intent-tag"

// Allow up to 60s for AI response generation + WhatsApp send
export const maxDuration = 60

// Admin phone to receive hot alerts
const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"

// ---------------------------------------------------------------------------
// GET - Webhook verification
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WhatsApp] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive messages, save to CRM, generate AI response, send reply
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Signature verification — STRICT (fail closed).
  //
  // This used to be `if (appSecret && !verify(...))`, which silently accepted
  // every unsigned payload the moment WHATSAPP_APP_SECRET was missing or
  // renamed — an open write endpoint with no warning anywhere. All three
  // secrets belong to the same Meta app, so accepting any of them keeps this
  // resilient to an env-var mixup without widening the trust domain.
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const verified = verifyWebhookSignatureAny(rawBody, signature, [
    process.env.WHATSAPP_APP_SECRET,
    process.env.META_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
  ])

  if (!verified) {
    console.warn("[WhatsApp Webhook] Invalid signature — rejected")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process: save to CRM + generate AI response + send reply
  try {
    await processAndReply(body)
  } catch (err) {
    console.error("[WhatsApp] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Main processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAndReply(body: any) {
  const messages = parseWhatsAppWebhook(body)
  if (messages.length === 0) return

  const supabase = createAdminClient()

  // Alerts and tagging run concurrently with the AI reply, but every promise
  // is collected and awaited before this function returns. Vercel freezes the
  // instance the moment the webhook responds, so a truly fire-and-forget
  // notification can be killed mid-flight — which is how new messages ended up
  // reaching nobody.
  const background: Promise<unknown>[] = []

  for (const msg of messages) {
    try {
      const normalizedPhone = normalizePhone(msg.phone)

      // --- Deduplication ---
      const { data: existing } = await supabase
        .from("crm_interactions")
        .select("id")
        .eq("channel_message_id", msg.messageId)
        .limit(1)

      if (existing && existing.length > 0) continue

      // --- Upsert contact ---
      let contactId: string

      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("whatsapp_phone", normalizedPhone)
        .limit(1)

      if (existingContact && existingContact.length > 0) {
        contactId = existingContact[0].id
        await supabase
          .from("crm_contacts")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", contactId)
      } else {
        const firstName = msg.senderName?.split(" ")[0] ?? normalizedPhone
        const lastName = msg.senderName?.split(" ").slice(1).join(" ") ?? ""

        const { data: newContact, error: contactError } = await supabase
          .from("crm_contacts")
          .insert({
            first_name: firstName,
            last_name: lastName,
            whatsapp_phone: normalizedPhone,
            phone: normalizedPhone,
            source: "whatsapp",
            // Attribution: which ad brought this person in
            source_detail: msg.referral
              ? `Pauta: ${msg.referral.headline ?? msg.referral.source_url ?? msg.referral.source_id ?? "Click-to-WhatsApp"}`
              : null,
            utm_source: msg.referral ? "meta_ctwa" : null,
            city: "Medellin",
            status: "active",
            interests: [],
          })
          .select("id")
          .single()

        if (contactError || !newContact) {
          console.error("[WhatsApp] Contact creation failed:", contactError)
          continue
        }
        contactId = newContact.id
        console.log("[WhatsApp] New contact:", contactId)
      }

      // --- Save inbound message (with media if present) ---
      const occurredAt = msg.timestamp
        ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString()

      // --- Media: download from Meta, store in Supabase, optional AI processing ---
      let mediaUrl: string | null = null
      let mediaMime: string | null = null
      let mediaType: string | null = null
      let transcription: string | null = null
      let visionCaption: string | null = null

      if (msg.media) {
        try {
          const meta = await getWhatsAppMediaUrl(msg.media.id)
          if (meta?.url) {
            const stored = await downloadAndStore({
              supabase,
              metaUrl: meta.url,
              bearerToken: process.env.WHATSAPP_ACCESS_TOKEN,
              contactId,
              kind: msg.media.kind,
              mime: meta.mime ?? msg.media.mime,
              filename: msg.media.filename,
            })
            mediaUrl = stored.url
            mediaMime = meta.mime ?? msg.media.mime
            mediaType = msg.media.kind

            // Audio → Whisper
            if (msg.media.kind === "audio") {
              transcription = await transcribeAudio({
                audioUrl: stored.url,
                mime: mediaMime,
              })
            }
            // Image → Claude vision
            if (msg.media.kind === "image" || msg.media.kind === "sticker") {
              visionCaption = await captionImage({
                imageUrl: stored.url,
                mime: mediaMime,
              })
            }
          }
        } catch (e) {
          console.error("[WhatsApp] Media processing failed:", e)
        }
      }

      const { error: inboundInsertError } = await supabase
        .from("crm_interactions")
        .insert({
          contact_id: contactId,
          type: "whatsapp_message",
          direction: "inbound",
          body: msg.message || msg.caption || "",
          channel_message_id: msg.messageId,
          channel_metadata: {
            phone: msg.phone,
            sender_name: msg.senderName ?? null,
            ...(msg.referral ? { referral: msg.referral } : {}),
          },
          media_url: mediaUrl,
          media_type: mediaType,
          media_mime: mediaMime,
          media_caption: msg.caption ?? null,
          transcription,
          vision_caption: visionCaption,
          occurred_at: occurredAt,
        })
      if (inboundInsertError) {
        // 23505 = unique violation on channel_message_id: a concurrent Meta
        // retry already owns this message, so skipping is correct.
        //
        // Anything else is a real write failure and the customer's message is
        // gone. Treating every error as "duplicate" made those losses invisible
        // — the log even claimed the opposite of what happened.
        if (inboundInsertError.code === "23505") {
          console.log("[WhatsApp] Duplicate webhook suppressed:", msg.messageId)
        } else {
          console.error(
            "[WhatsApp] MESSAGE LOST — insert failed:",
            inboundInsertError.code,
            inboundInsertError.message
          )
          background.push(
            alertAdminSystemFailure(
              "Mensaje perdido al guardar",
              `No se pudo guardar un WhatsApp entrante (${inboundInsertError.code ?? "sin código"}: ${inboundInsertError.message}). Revisa la conversación manualmente — el cliente escribió y el CRM no lo registró.`
            ).catch((e) => console.error("[WhatsApp] Loss alert failed:", e))
          )
        }
        continue
      }

      console.log("[WhatsApp] Inbound saved for:", contactId)

      // --- HOT ALERT: notify admin if message shows buying intent ---
      // Built from the transcription / vision caption too, not just the raw
      // text field: for a voice note or a photo that field is empty, which made
      // every media alert arrive blank and kept the buying-intent detector from
      // ever firing on the way most customers actually write.
      const alertText = describeInbound({
        text: msg.message,
        caption: msg.caption,
        transcription,
        visionCaption,
        mediaType,
      })
      const detection = detectHotMessage(alertText)
      const contactName = msg.senderName ?? normalizedPhone
      // Surface the originating ad in admin notifications
      const messageForAlerts = msg.referral
        ? `${alertText}\n📣 Viene de la pauta: ${msg.referral.headline ?? "Click-to-WhatsApp"}`
        : alertText
      const isAdminSelf = ADMIN_PHONE === normalizedPhone.replace(/\+/g, "")
      const hotPingFired = detection.isHot && !isAdminSelf

      if (!isAdminSelf) {
        if (hotPingFired) {
          background.push(
            sendHotAlert({
              adminPhone: ADMIN_PHONE,
              contactName,
              contactId,
              channel: "whatsapp",
              message: messageForAlerts,
              detection,
            }).catch((e) => console.error("[WhatsApp] Hot alert failed:", e))
          )
        }
        background.push(
          notifyAdminOfNewMessage({
            supabase,
            contactId,
            contactName,
            channel: "whatsapp",
            message: messageForAlerts,
            skip: hotPingFired, // hot alert already pushed for this message
          }).catch((e) => console.error("[WhatsApp] Notify admin failed:", e))
        )
      }

      // --- AUTO-TAG by intent (fire-and-forget, doesn't block the bot) ---
      const intentInput = transcription
        ? `${msg.message} ${transcription}`.trim()
        : msg.message
      if (intentInput && intentInput.length > 2) {
        background.push(
          classifyIntent(intentInput)
            .then((res) => {
              if (res) return applyIntentTag(supabase, contactId, res.intent, res.confidence)
            })
            .catch((e) => console.error("[WhatsApp] Intent tag failed:", e))
        )
      }

      // --- AI REPLY GATE: respect per-contact pause + global pause ---
      const gate = await shouldAIReply(supabase, contactId)
      if (!gate.ok) {
        console.log(
          `[WhatsApp] AI skipped for ${contactId} — reason=${gate.reason}`
        )
        continue
      }

      // --- Get conversation history for context ---
      const { data: history } = await supabase
        .from("crm_interactions")
        .select("direction, body")
        .eq("contact_id", contactId)
        .eq("type", "whatsapp_message")
        .order("occurred_at", { ascending: false })
        .limit(10)

      // Fetch the most RECENT 10, then restore chronological order. (Ascending
      // + limit returned the oldest 10, so the bot never saw recent turns.)
      const conversationHistory = [...(history ?? [])]
        .reverse()
        .filter((h) => h.body)
        .map((h) => ({
          role: (h.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
          content: h.body as string,
        }))

      // --- Generate AI response ---
      // When the message is media-only, give the bot context from
      // transcription (audio) or vision caption (image) so it can respond.
      const promptForAI = buildAIInput({
        text: msg.message,
        caption: msg.caption,
        transcription,
        visionCaption,
        mediaType,
      })
      if (!promptForAI) {
        // Nothing the bot can respond to — skip silently
        continue
      }
      // If the user came from an ad, tell the bot which one so a bare
      // "info" / "precio?" can be answered in context.
      const adContext = msg.referral
        ? `[Contexto: el cliente llegó desde la pauta "${
            msg.referral.headline ?? "Click-to-WhatsApp"
          }"${msg.referral.body ? ` — texto del anuncio: "${msg.referral.body}"` : ""}. Si pregunta algo genérico como "info" o "precio", se refiere a lo que ofrece ese anuncio.]\n\n`
        : ""
      const aiResponse = await generateAgentResponse(
        adContext + promptForAI,
        conversationHistory
      )

      // AI call failed (retired model / bad key / outage). Alert the operator
      // instead of silently sending a canned reply, and let a human take over.
      if (!aiResponse) {
        await alertAdminSystemFailure(
          "Bot de IA caído",
          `La IA no pudo responder un WhatsApp (contacto ${contactId}). Revisa el modelo/credenciales de Anthropic — atiende manualmente mientras tanto.`
        )
        continue
      }

      // --- Send reply via WhatsApp API ---
      const sent = await sendWhatsAppMessage(normalizedPhone, aiResponse)

      if (sent.ok) {
        // Save outbound message in CRM
        await supabase.from("crm_interactions").insert({
          contact_id: contactId,
          type: "whatsapp_message",
          direction: "outbound",
          body: aiResponse,
          channel_metadata: { ai_generated: true },
          occurred_at: new Date().toISOString(),
        })
        console.log("[WhatsApp] AI replied to:", contactId)
      } else {
        console.error("[WhatsApp] Failed to send reply to:", normalizedPhone, sent.error)
        // Token / permission errors mean the channel is broken — alert, don't
        // just log (an expired token silently kills every reply otherwise).
        if ([190, 200, 463, 467].includes(Number(sent.errorCode))) {
          await alertAdminSystemFailure(
            "Envío de WhatsApp fallando",
            `No se pudo enviar la respuesta del bot: ${sent.error}. Probablemente el token de Meta expiró — renuévalo en Business Manager.`
          )
        }
      }
    } catch (error) {
      console.error("[WhatsApp] Error:", error)
    }
  }

  // Let alerts and tagging finish before the runtime freezes this instance.
  await Promise.allSettled(background)
}

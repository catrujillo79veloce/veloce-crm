import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignatureAny } from "@/lib/integrations/webhook-verify"
import { parseInstagramWebhook, sendInstagramMessage } from "@/lib/integrations/instagram"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"
import { notifyAdminOfNewMessage, alertAdminSystemFailure } from "@/lib/ai/notify-admin"
import { shouldAIReply } from "@/lib/ai/should-reply"
import { downloadAndStore } from "@/lib/integrations/media-storage"
import { transcribeAudio } from "@/lib/ai/transcribe"
import { captionImage } from "@/lib/ai/vision"
import { buildAIInput, describeInbound } from "@/lib/ai/build-ai-input"
import { classifyIntent } from "@/lib/ai/classify-intent"
import { applyIntentTag } from "@/lib/ai/apply-intent-tag"

// Allow up to 60s for AI response generation + Instagram send
export const maxDuration = 60

const ADMIN_PHONE = process.env.ADMIN_ALERT_PHONE ?? "573176354893"

// ---------------------------------------------------------------------------
// GET - Webhook verification
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log("[Instagram Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Instagram Webhook] Verification failed")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive Instagram messaging events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Signature verification — STRICT (fail closed).
  //
  // Instagram messaging uses Instagram Login (IGAA tokens, graph.instagram.com)
  // and Meta signs those webhooks with the dedicated Instagram-app secret, which
  // is NOT the shared Meta/Facebook app secret — enforcing against the wrong one
  // previously 401'd all real IG traffic. The real secret now lives in
  // INSTAGRAM_APP_SECRET and was verified against REAL Meta deliveries
  // (2026-08-06: every inbound logged "Signature OK" in soft mode), so
  // rejecting mismatches no longer drops legitimate traffic.
  //
  // All three secrets belong to the same Meta app, so accepting any of them
  // keeps this resilient to an env-var mixup without widening the trust domain.
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const verified = verifyWebhookSignatureAny(rawBody, signature, [
    process.env.INSTAGRAM_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
    process.env.META_APP_SECRET,
  ])
  if (!verified) {
    console.warn("[Instagram Webhook] Invalid signature — rejected")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Process: save to CRM + generate AI response + send reply
  try {
    await processInstagramMessages(body)
  } catch (err) {
    console.error("[Instagram Webhook] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Main processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

async function processInstagramMessages(body: any) {
  const messages = parseInstagramWebhook(body)

  if (messages.length === 0) return

  const supabase = createAdminClient()

  // Alerts and tagging run concurrently with the AI reply but are awaited
  // before returning — Vercel freezes the instance as soon as the webhook
  // responds, which silently kills genuinely fire-and-forget work.
  const background: Promise<unknown>[] = []

  for (const msg of messages) {
    try {
      // --- Deduplication ---
      const { data: existing } = await supabase
        .from("crm_interactions")
        .select("id")
        .eq("channel_message_id", msg.messageId)
        .limit(1)

      if (existing && existing.length > 0) {
        console.log("[Instagram] Duplicate message skipped:", msg.messageId)
        continue
      }

      // --- Upsert contact by instagram_id ---
      let contactId: string

      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("id, utm_source")
        .eq("instagram_id", msg.senderId)
        .limit(1)

      if (existingContact && existingContact.length > 0) {
        contactId = existingContact[0].id
        const contactUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        // Late attribution: the contact existed before clicking the ad
        if (msg.referral && !existingContact[0].utm_source) {
          contactUpdate.source_detail = `Pauta: ${msg.referral.headline ?? msg.referral.source_id ?? "Click-to-Instagram"}`
          contactUpdate.utm_source = "meta_ctd"
        }
        await supabase
          .from("crm_contacts")
          .update(contactUpdate)
          .eq("id", contactId)
      } else {
        const { data: newContact, error: contactError } = await supabase
          .from("crm_contacts")
          .insert({
            first_name: "Instagram",
            last_name: `User ${msg.senderId.slice(-6)}`,
            instagram_id: msg.senderId,
            source: "instagram",
            source_detail: msg.referral
              ? `Pauta: ${msg.referral.headline ?? msg.referral.source_id ?? "Click-to-Instagram"}`
              : null,
            utm_source: msg.referral ? "meta_ctd" : null,
            city: "Medellin",
            status: "active",
            interests: [],
          })
          .select("id")
          .single()

        if (contactError || !newContact) {
          console.error("[Instagram] Contact creation failed:", contactError)
          continue
        }

        contactId = newContact.id
        console.log("[Instagram] New contact created:", contactId)
      }

      // --- Media: download from Meta → store → transcribe/caption ---
      let mediaUrl: string | null = null
      let mediaMime: string | null = null
      let mediaType: string | null = null
      let transcription: string | null = null
      let visionCaption: string | null = null

      if (msg.media) {
        try {
          const stored = await downloadAndStore({
            supabase,
            metaUrl: msg.media.url,
            contactId,
            kind: msg.media.kind,
            mime: msg.media.mime,
          })
          // Trust the bytes, not Meta's attachment type: a shared reel /
          // video story-reply arrives tagged `image` but is really an MP4.
          mediaUrl = stored.url
          mediaMime = stored.mime
          mediaType = stored.kind

          if (stored.kind === "audio") {
            transcription = await transcribeAudio({
              audioUrl: stored.url,
              mime: stored.mime,
            })
          }
          if (stored.kind === "image") {
            visionCaption = await captionImage({
              imageUrl: stored.url,
              mime: stored.mime,
            })
          }
        } catch (e) {
          console.error("[Instagram] Media processing failed:", e)
        }
      }

      // --- Save inbound message ---
      const { error: inboundInsertError } = await supabase
        .from("crm_interactions")
        .insert({
          contact_id: contactId,
          type: "instagram_message",
          direction: "inbound",
          subject: null,
          body: msg.message,
          channel_message_id: msg.messageId,
          channel_metadata: {
            sender_id: msg.senderId,
            timestamp: msg.timestamp,
            ...(msg.referral ? { referral: msg.referral } : {}),
          },
          media_url: mediaUrl,
          media_type: mediaType,
          media_mime: mediaMime,
          transcription,
          vision_caption: visionCaption,
          occurred_at: new Date(msg.timestamp).toISOString(),
        })
      if (inboundInsertError) {
        // 23505 = unique guard on channel_message_id (a concurrent retry).
        // Anything else means the customer's message was lost, which must not
        // be logged as a harmless duplicate.
        if (inboundInsertError.code === "23505") {
          console.log("[Instagram] Duplicate webhook suppressed:", msg.messageId)
        } else {
          console.error(
            "[Instagram] MESSAGE LOST — insert failed:",
            inboundInsertError.code,
            inboundInsertError.message
          )
          background.push(
            alertAdminSystemFailure(
              "Mensaje perdido al guardar",
              `No se pudo guardar un DM de Instagram (${inboundInsertError.code ?? "sin código"}: ${inboundInsertError.message}). Revísalo manualmente en Instagram.`
            ).catch((e) => console.error("[Instagram] Loss alert failed:", e))
          )
        }
        continue
      }

      console.log("[Instagram] Inbound saved for:", contactId)

      // Referral-only event (ad click, no text/media): the pauta is already
      // attached to the contact + thread — nothing for alerts or the bot to do.
      if (!msg.message && !msg.media) continue

      // --- HOT ALERT ---
      // Built from the transcription / vision caption too — for a voice note
      // or a photo the raw text field is empty, which made media alerts arrive
      // blank and kept the buying-intent detector from ever firing on them.
      const alertText = describeInbound({
        text: msg.message,
        transcription,
        visionCaption,
        mediaType,
      })
      const detection = detectHotMessage(alertText)
      const contactName = `Instagram User ${msg.senderId.slice(-6)}`
      const hotPingFired = detection.isHot

      if (hotPingFired) {
        background.push(
          sendHotAlert({
            adminPhone: ADMIN_PHONE,
            contactName,
            contactId,
            channel: "instagram",
            message: alertText,
            detection,
          }).catch((e) => console.error("[Instagram] Hot alert failed:", e))
        )
      }
      background.push(
        notifyAdminOfNewMessage({
          supabase,
          contactId,
          contactName,
          channel: "instagram",
          message: alertText,
          skip: hotPingFired,
        }).catch((e) => console.error("[Instagram] Notify admin failed:", e))
      )

      // --- AUTO-TAG by intent (fire-and-forget) ---
      const intentInput = transcription
        ? `${msg.message} ${transcription}`.trim()
        : msg.message
      if (intentInput && intentInput.length > 2) {
        background.push(
          classifyIntent(intentInput)
            .then((res) => {
              if (res) return applyIntentTag(supabase, contactId, res.intent, res.confidence)
            })
            .catch((e) => console.error("[Instagram] Intent tag failed:", e))
        )
      }

      // --- AI REPLY GATE: respect per-contact pause + global pause ---
      const gate = await shouldAIReply(supabase, contactId)
      if (!gate.ok) {
        console.log(
          `[Instagram] AI skipped for ${contactId} — reason=${gate.reason}`
        )
        continue
      }

      // --- Get conversation history for context ---
      const { data: history } = await supabase
        .from("crm_interactions")
        .select("direction, body")
        .eq("contact_id", contactId)
        .eq("type", "instagram_message")
        .order("occurred_at", { ascending: false })
        .limit(10)

      // Most RECENT 10, restored to chronological order (ascending+limit
      // returned the oldest 10, so the bot never saw recent turns).
      const conversationHistory = [...(history ?? [])]
        .reverse()
        .filter((h) => h.body)
        .map((h) => ({
          role: (h.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
          content: h.body as string,
        }))

      // --- Generate AI response (using media context when no text) ---
      const promptForAI = buildAIInput({
        text: msg.message,
        transcription,
        visionCaption,
        mediaType,
      })
      if (!promptForAI) {
        // Media we couldn't process and no text — skip the bot silently
        continue
      }
      // If the user came from an ad, tell the bot which one so a bare
      // "info" / "precio?" can be answered in context (parity with WhatsApp).
      const adContext = msg.referral
        ? `[Contexto: el cliente llegó desde la pauta "${
            msg.referral.headline ?? "Click-to-Instagram"
          }"${msg.referral.body ? ` — texto del anuncio: "${msg.referral.body}"` : ""}. Si pregunta algo genérico como "info" o "precio", se refiere a lo que ofrece ese anuncio.]\n\n`
        : ""
      const aiResponse = await generateAgentResponse(
        adContext + promptForAI,
        conversationHistory
      )

      // AI failed — alert the operator instead of silently sending a canned
      // reply, and let a human take over.
      if (!aiResponse) {
        await alertAdminSystemFailure(
          "Bot de IA caído",
          `La IA no pudo responder un Instagram (contacto ${contactId}). Revisa el modelo/credenciales de Anthropic — atiende manualmente mientras tanto.`
        )
        continue
      }

      // --- Send reply via Instagram API ---
      const sent = await sendInstagramMessage(msg.senderId, aiResponse)

      if (sent.ok) {
        await supabase.from("crm_interactions").insert({
          contact_id: contactId,
          type: "instagram_message",
          direction: "outbound",
          body: aiResponse,
          channel_metadata: { ai_generated: true, recipient_id: msg.senderId },
          occurred_at: new Date().toISOString(),
        })
        console.log("[Instagram] AI replied to:", contactId)
      } else {
        console.error("[Instagram] Failed to send reply to:", msg.senderId, sent.error)
        if ([190, 200, 463, 467].includes(Number(sent.errorCode))) {
          await alertAdminSystemFailure(
            "Envío de Instagram fallando",
            `No se pudo enviar la respuesta del bot: ${sent.error}. Probablemente el token de Instagram expiró.`
          )
        }
      }
    } catch (error) {
      console.error("[Instagram] Message processing error:", error)
    }
  }

  // Let alerts and tagging finish before the runtime freezes this instance.
  await Promise.allSettled(background)
}

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/integrations/webhook-verify"
import { parseWhatsAppWebhook, sendWhatsAppMessage } from "@/lib/integrations/whatsapp"
import { normalizePhone } from "@/lib/utils"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"
import { notifyAdminOfNewMessage } from "@/lib/ai/notify-admin"
import { shouldAIReply } from "@/lib/ai/should-reply"
import {
  downloadAndStore,
  getWhatsAppMediaUrl,
} from "@/lib/integrations/media-storage"
import { transcribeAudio } from "@/lib/ai/transcribe"
import { captionImage } from "@/lib/ai/vision"
import { buildAIInput } from "@/lib/ai/build-ai-input"
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

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? ""

  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
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

      await supabase.from("crm_interactions").insert({
        contact_id: contactId,
        type: "whatsapp_message",
        direction: "inbound",
        body: msg.message || msg.caption || "",
        channel_message_id: msg.messageId,
        channel_metadata: {
          phone: msg.phone,
          sender_name: msg.senderName ?? null,
        },
        media_url: mediaUrl,
        media_type: mediaType,
        media_mime: mediaMime,
        media_caption: msg.caption ?? null,
        transcription,
        vision_caption: visionCaption,
        occurred_at: occurredAt,
      })

      console.log("[WhatsApp] Inbound saved for:", contactId)

      // --- HOT ALERT: notify admin if message shows buying intent ---
      const detection = detectHotMessage(msg.message)
      const contactName = msg.senderName ?? normalizedPhone
      const isAdminSelf = ADMIN_PHONE === normalizedPhone.replace(/\+/g, "")
      let hotPingFired = false
      if (detection.isHot && !isAdminSelf) {
        hotPingFired = true
        sendHotAlert({
          adminPhone: ADMIN_PHONE,
          contactName,
          contactId,
          channel: "whatsapp",
          message: msg.message,
          detection,
        }).catch((e) => console.error("[WhatsApp] Hot alert failed:", e))
      }

      // --- GENERIC NOTIFY: debounced ping for every new inbound ---
      if (!isAdminSelf) {
        notifyAdminOfNewMessage({
          supabase,
          contactId,
          contactName,
          channel: "whatsapp",
          message: msg.message,
          skip: hotPingFired, // hot alert already covers this message
        }).catch((e) => console.error("[WhatsApp] Notify admin failed:", e))
      }

      // --- AUTO-TAG by intent (fire-and-forget, doesn't block the bot) ---
      const intentInput = transcription
        ? `${msg.message} ${transcription}`.trim()
        : msg.message
      if (intentInput && intentInput.length > 2) {
        classifyIntent(intentInput)
          .then((res) => {
            if (res) return applyIntentTag(supabase, contactId, res.intent, res.confidence)
          })
          .catch((e) => console.error("[WhatsApp] Intent tag failed:", e))
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
        .order("occurred_at", { ascending: true })
        .limit(10)

      const conversationHistory = (history ?? [])
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
      const aiResponse = await generateAgentResponse(promptForAI, conversationHistory)

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
      }
    } catch (error) {
      console.error("[WhatsApp] Error:", error)
    }
  }
}

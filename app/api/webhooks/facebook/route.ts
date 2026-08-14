import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignatureAny } from "@/lib/integrations/webhook-verify"
import { fetchLeadData, parseLeadgenWebhook, sendFacebookMessage } from "@/lib/integrations/facebook"
import {
  extractFirstAttachment,
  normalizeMessengerReferral,
} from "@/lib/integrations/instagram"
import { downloadAndStore } from "@/lib/integrations/media-storage"
import { normalizePhone } from "@/lib/utils"
import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { detectHotMessage, sendHotAlert } from "@/lib/ai/hot-detector"
import { notifyAdminOfNewMessage, alertAdminSystemFailure } from "@/lib/ai/notify-admin"
import { shouldAIReply } from "@/lib/ai/should-reply"
import { transcribeAudio } from "@/lib/ai/transcribe"
import { captionImage } from "@/lib/ai/vision"
import { buildAIInput, describeInbound } from "@/lib/ai/build-ai-input"
import { classifyIntent } from "@/lib/ai/classify-intent"
import { applyIntentTag } from "@/lib/ai/apply-intent-tag"

// Allow up to 60s for AI response generation + Facebook send
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

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log("[Facebook Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Facebook Webhook] Verification failed")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ---------------------------------------------------------------------------
// POST - Receive Facebook Lead Ads + Messenger events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Signature verification — STRICT (fail closed).
  //
  // This used to be `if (appSecret && !verify(...))`, which silently accepted
  // every unsigned payload the moment FACEBOOK_APP_SECRET went missing. All
  // three secrets belong to the same Meta app, so accepting any of them keeps
  // this resilient to an env-var mixup without widening the trust domain.
  const signature = request.headers.get("x-hub-signature-256") ?? ""
  const verified = verifyWebhookSignatureAny(rawBody, signature, [
    process.env.FACEBOOK_APP_SECRET,
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ])

  if (!verified) {
    console.warn("[Facebook Webhook] Invalid signature — rejected")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Route based on object type
  try {
    if (body.object === "page") {
      // Messenger events come with object: "page"
      await processMessengerMessages(body)
    } else if (body.entry?.[0]?.changes?.[0]?.field === "leadgen") {
      // Lead Ads events
      await processLeadgenEvents(body)
    } else {
      // Try both - sometimes mixed
      await processMessengerMessages(body)
      await processLeadgenEvents(body)
    }
  } catch (err) {
    console.error("[Facebook Webhook] Processing error:", err)
  }

  return NextResponse.json({ status: "ok" }, { status: 200 })
}

// ---------------------------------------------------------------------------
// Messenger processing: CRM + AI Agent + Reply
// ---------------------------------------------------------------------------

async function processMessengerMessages(body: any) {
  const entries = body?.entry ?? []
  const supabase = createAdminClient()

  // Alerts and tagging run concurrently with the AI reply but are awaited
  // before returning — Vercel freezes the instance as soon as the webhook
  // responds, which silently kills genuinely fire-and-forget work.
  const background: Promise<unknown>[] = []

  for (const entry of entries) {
    const messagingEvents = entry?.messaging ?? []

    for (const event of messagingEvents) {
      try {
        // Skip echo messages (sent by the page itself)
        if (event.message?.is_echo) continue

        const text: string = event.message?.text ?? ""
        const attachments = event.message?.attachments ?? []
        const media = extractFirstAttachment(attachments)
        // The referral can ride on the message (CTM ad opening a new thread)
        // or arrive as a standalone messaging_referrals / postback event when
        // the user clicks an ad into an existing thread (no message attached).
        const referral = normalizeMessengerReferral(event)

        // Need at least text, media, or an ad referral to proceed
        if (!text && !media && !referral) continue

        const senderId: string = event.sender?.id ?? ""
        const timestamp: number = event.timestamp ?? Date.now()
        // Standalone referral events have no mid — synthesize a stable id for dedup
        const messageId: string =
          event.message?.mid ?? `fbref-${senderId}-${timestamp}`

        if (!senderId || !messageId) continue

        // --- Deduplication ---
        const { data: existing } = await supabase
          .from("crm_interactions")
          .select("id")
          .eq("channel_message_id", messageId)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log("[Messenger] Duplicate skipped:", messageId)
          continue
        }

        // --- Upsert contact by facebook_id ---
        let contactId: string

        const { data: existingContact } = await supabase
          .from("crm_contacts")
          .select("id, utm_source")
          .eq("facebook_id", senderId)
          .limit(1)

        if (existingContact && existingContact.length > 0) {
          contactId = existingContact[0].id
          const contactUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          }
          // Late attribution: the contact existed before clicking the ad
          if (referral && !existingContact[0].utm_source) {
            contactUpdate.source_detail = `Pauta: ${referral.headline ?? referral.source_id ?? "Click-to-Messenger"}`
            contactUpdate.utm_source = "meta_ctm"
          }
          await supabase
            .from("crm_contacts")
            .update(contactUpdate)
            .eq("id", contactId)
        } else {
          const { data: newContact, error: contactError } = await supabase
            .from("crm_contacts")
            .insert({
              first_name: "Facebook",
              last_name: `User ${senderId.slice(-6)}`,
              facebook_id: senderId,
              source: "facebook_lead_ads",
              source_detail: referral
                ? `Pauta: ${referral.headline ?? referral.source_id ?? "Click-to-Messenger"}`
                : "messenger",
              utm_source: referral ? "meta_ctm" : null,
              city: "Medellin",
              status: "active",
              interests: [],
            })
            .select("id")
            .single()

          if (contactError || !newContact) {
            console.error("[Messenger] Contact creation failed:", contactError)
            continue
          }

          contactId = newContact.id
          console.log("[Messenger] New contact:", contactId)
        }

        // --- Media: download → store → transcribe/caption ---
        let mediaUrl: string | null = null
        let mediaMime: string | null = null
        let mediaType: string | null = null
        let transcription: string | null = null
        let visionCaption: string | null = null

        if (media) {
          try {
            const stored = await downloadAndStore({
              supabase,
              metaUrl: media.url,
              contactId,
              kind: media.kind,
              mime: media.mime,
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
            console.error("[Messenger] Media processing failed:", e)
          }
        }

        // --- Save inbound ---
        const { error: inboundInsertError } = await supabase
          .from("crm_interactions")
          .insert({
            contact_id: contactId,
            type: "facebook_message",
            direction: "inbound",
            body: text,
            channel_message_id: messageId,
            channel_metadata: {
              sender_id: senderId,
              timestamp,
              ...(referral ? { referral } : {}),
            },
            media_url: mediaUrl,
            media_type: mediaType,
            media_mime: mediaMime,
            transcription,
            vision_caption: visionCaption,
            occurred_at: new Date(timestamp).toISOString(),
          })
        if (inboundInsertError) {
          // 23505 = unique index on channel_message_id (a concurrent Meta
          // retry already owns this message). Anything else means the
          // customer's message was lost and must not be logged as a duplicate.
          if (inboundInsertError.code === "23505") {
            console.log("[Messenger] Duplicate webhook suppressed:", messageId)
          } else {
            console.error(
              "[Messenger] MESSAGE LOST — insert failed:",
              inboundInsertError.code,
              inboundInsertError.message
            )
            background.push(
              alertAdminSystemFailure(
                "Mensaje perdido al guardar",
                `No se pudo guardar un mensaje de Messenger (${inboundInsertError.code ?? "sin código"}: ${inboundInsertError.message}). Revísalo manualmente en Facebook.`
              ).catch((e) => console.error("[Messenger] Loss alert failed:", e))
            )
          }
          continue
        }

        // Referral-only event (ad click, no text/media): the pauta is already
        // attached to the contact + thread — nothing for alerts or the bot to do.
        if (!text && !media) continue

        // --- HOT ALERT ---
        // Built from the transcription / vision caption too — for a voice note
        // or a photo the raw text field is empty, which made media alerts
        // arrive blank and kept the buying-intent detector from firing on them.
        const alertText = describeInbound({
          text,
          transcription,
          visionCaption,
          mediaType,
        })
        const detection = detectHotMessage(alertText)
        const contactName = `Facebook User ${senderId.slice(-6)}`
        const hotPingFired = detection.isHot

        if (hotPingFired) {
          background.push(
            sendHotAlert({
              adminPhone: ADMIN_PHONE,
              contactName,
              contactId,
              channel: "facebook",
              message: alertText,
              detection,
            }).catch((e) => console.error("[Messenger] Hot alert failed:", e))
          )
        }
        background.push(
          notifyAdminOfNewMessage({
            supabase,
            contactId,
            contactName,
            channel: "facebook",
            message: alertText,
            skip: hotPingFired,
          }).catch((e) => console.error("[Messenger] Notify admin failed:", e))
        )

        // --- AUTO-TAG by intent (fire-and-forget) ---
        const intentInput = transcription
          ? `${text} ${transcription}`.trim()
          : text
        if (intentInput && intentInput.length > 2) {
          background.push(
            classifyIntent(intentInput)
              .then((res) => {
                if (res)
                  return applyIntentTag(
                    supabase,
                    contactId,
                    res.intent,
                    res.confidence
                  )
              })
              .catch((e) => console.error("[Messenger] Intent tag failed:", e))
          )
        }

        // --- AI REPLY GATE: respect per-contact pause + global pause ---
        const gate = await shouldAIReply(supabase, contactId)
        if (!gate.ok) {
          console.log(
            `[Messenger] AI skipped for ${contactId} — reason=${gate.reason}`
          )
          continue
        }

        // --- Conversation history ---
        const { data: history } = await supabase
          .from("crm_interactions")
          .select("direction, body")
          .eq("contact_id", contactId)
          .eq("type", "facebook_message")
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

        // --- AI response (using media context when no text) ---
        const promptForAI = buildAIInput({
          text,
          transcription,
          visionCaption,
          mediaType,
        })
        if (!promptForAI) {
          continue
        }
        // If the user came from an ad, tell the bot which one so a bare
        // "info" / "precio?" can be answered in context (parity with WhatsApp).
        const adContext = referral
          ? `[Contexto: el cliente llegó desde la pauta "${
              referral.headline ?? "Click-to-Messenger"
            }"${referral.body ? ` — texto del anuncio: "${referral.body}"` : ""}. Si pregunta algo genérico como "info" o "precio", se refiere a lo que ofrece ese anuncio.]\n\n`
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
            `La IA no pudo responder un Messenger (contacto ${contactId}). Revisa el modelo/credenciales de Anthropic — atiende manualmente mientras tanto.`
          )
          continue
        }

        // --- Send via Messenger ---
        const sent = await sendFacebookMessage(senderId, aiResponse)

        if (sent.ok) {
          await supabase.from("crm_interactions").insert({
            contact_id: contactId,
            type: "facebook_message",
            direction: "outbound",
            body: aiResponse,
            channel_metadata: { ai_generated: true, recipient_id: senderId },
            occurred_at: new Date().toISOString(),
          })
          console.log("[Messenger] AI replied to:", contactId)
        } else {
          console.error("[Messenger] Send failed:", senderId, sent.error)
          if ([190, 200, 463, 467].includes(Number(sent.errorCode))) {
            await alertAdminSystemFailure(
              "Envío de Messenger fallando",
              `No se pudo enviar la respuesta del bot: ${sent.error}. Probablemente el token de la página de Facebook expiró.`
            )
          }
        }
      } catch (error) {
        console.error("[Messenger] Event error:", error)
      }
    }
  }

  // Let alerts and tagging finish before the runtime freezes this instance.
  await Promise.allSettled(background)
}

// ---------------------------------------------------------------------------
// Lead Ads processing (unchanged)
// ---------------------------------------------------------------------------

async function processLeadgenEvents(body: any) {
  const events = parseLeadgenWebhook(body)

  if (events.length === 0) return

  const supabase = createAdminClient()

  for (const event of events) {
    try {
      const leadData = await fetchLeadData(event.leadgenId)
      if (!leadData) {
        console.error("[Facebook] Could not fetch lead data for:", event.leadgenId)
        continue
      }

      // NOTE: Lead Ads payload does NOT include the user's Messenger PSID,
      // so we cannot set facebook_id here. Setting pageId would corrupt
      // Messenger lookups (every lead would share the page's id).
      const contactInsert: Record<string, unknown> = {
        first_name: leadData.first_name || "Facebook",
        last_name: leadData.last_name || "Lead",
        source: "facebook_lead_ads",
        source_detail: `form:${event.formId}`,
        city: leadData.city || "Medellin",
        status: "active",
        interests: [],
      }

      if (leadData.email) {
        contactInsert.email = leadData.email.toLowerCase().trim()
      }
      if (leadData.phone) {
        contactInsert.phone = normalizePhone(leadData.phone)
        contactInsert.whatsapp_phone = normalizePhone(leadData.phone)
      }

      const { data: contact, error: contactError } = await supabase
        .from("crm_contacts")
        .insert(contactInsert)
        .select("id")
        .single()

      if (contactError || !contact) {
        console.error("[Facebook] Contact creation failed:", contactError)
        continue
      }

      const assignedTo = await getNextRoundRobinMember(supabase)

      const { data: maxPosData } = await supabase
        .from("crm_leads")
        .select("position")
        .eq("status", "new")
        .order("position", { ascending: false })
        .limit(1)

      const nextPosition =
        maxPosData && maxPosData.length > 0
          ? maxPosData[0].position + 1
          : 0

      const { error: leadError } = await supabase.from("crm_leads").insert({
        contact_id: contact.id,
        title: `Facebook Lead - ${leadData.name || leadData.email || "Sin nombre"}`,
        status: "new",
        priority: "medium",
        source: "facebook_lead_ads",
        source_detail: `form:${event.formId}`,
        assigned_to: assignedTo,
        position: nextPosition,
        score: 0,
      })

      if (leadError) {
        console.error("[Facebook] Lead creation failed:", leadError)
      }

      if (assignedTo) {
        await supabase
          .from("crm_contacts")
          .update({ assigned_to: assignedTo })
          .eq("id", contact.id)
      }

      const { error: interactionError } = await supabase
        .from("crm_interactions")
        .insert({
          contact_id: contact.id,
          type: "website_form",
          direction: "inbound",
          subject: "Facebook Lead Ad Submission",
          body: JSON.stringify({
            source: "facebook_lead_ads",
            form_id: event.formId,
            lead_data: leadData.custom_fields,
          }),
          channel_message_id: event.leadgenId,
          channel_metadata: {
            platform: "facebook",
            page_id: event.pageId,
            form_id: event.formId,
            leadgen_id: event.leadgenId,
          },
          occurred_at: event.createdTime
            ? new Date(event.createdTime * 1000).toISOString()
            : new Date().toISOString(),
        })

      if (interactionError) {
        console.error("[Facebook] Interaction creation failed:", interactionError)
      }

      console.log("[Facebook] Lead processed:", contact.id, leadData.name)
    } catch (error) {
      console.error("[Facebook] Event processing error:", error)
    }
  }
}

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
    console.error("[Facebook] Round-robin assignment error:", error)
    return null
  }
}

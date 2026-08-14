// ---------------------------------------------------------------------------
// Web Push sender.
//
// Sends push notifications to all stored subscriptions (or a specific user's).
// Prunes dead subscriptions automatically and reports what actually happened,
// so a silently-broken push channel can be seen instead of guessed at.
// ---------------------------------------------------------------------------

import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.error(
      "[Push] VAPID keys missing — no device will ever be alerted. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
    )
    configured = false
    return false
  }
  const subject = process.env.VAPID_SUBJECT ?? "mailto:gerencia@veloce.com.co"
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  } catch (e) {
    console.error("[Push] Invalid VAPID configuration:", e)
    configured = false
  }
  return configured
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  /** New customer messages are time-critical; keep them at high urgency. */
  urgency?: "very-low" | "low" | "normal" | "high"
}

export interface PushResult {
  sent: number
  pruned: number
  failed: number
  /** Present when nothing could be sent, for surfacing in health checks. */
  reason?: string
}

/**
 * Legacy FCM endpoints (`/fcm/send/...`) were retired by Google; subscriptions
 * created against them can never be delivered again and must be re-registered
 * from the device.
 */
function isDeadEndpoint(endpoint: string): boolean {
  return endpoint.includes("fcm.googleapis.com/fcm/send/")
}

/**
 * Send a push to every subscribed device. If authUserId is given, only that
 * user's devices receive it; otherwise all team members do.
 *
 * Always await this. On Vercel the function is frozen once the response is
 * returned, so a fire-and-forget push can be killed before it leaves the box.
 */
export async function sendPush(
  payload: PushPayload,
  authUserId?: string
): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { sent: 0, pruned: 0, failed: 0, reason: "vapid_not_configured" }
  }

  const supabase = createAdminClient()
  let query = supabase
    .from("crm_push_subscriptions")
    .select("id, endpoint, p256dh, auth")

  if (authUserId) query = query.eq("auth_user_id", authUserId)

  const { data: subs, error } = await query
  if (error) {
    console.error("[Push] Could not read subscriptions:", error)
    return { sent: 0, pruned: 0, failed: 0, reason: "subscriptions_unreadable" }
  }
  if (!subs || subs.length === 0) {
    console.warn(
      "[Push] No subscribed devices — nobody will be alerted. Enable notifications from the CRM on the phone."
    )
    return { sent: 0, pruned: 0, failed: 0, reason: "no_subscriptions" }
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/inbox",
    tag: payload.tag,
  })

  let sent = 0
  let failed = 0
  const deadIds: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      const endpoint = s.endpoint as string

      if (isDeadEndpoint(endpoint)) {
        console.warn(
          "[Push] Dropping subscription on the retired FCM legacy endpoint — the device must re-enable notifications."
        )
        deadIds.push(s.id as string)
        return
      }

      try {
        await webpush.sendNotification(
          {
            endpoint,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          body,
          {
            TTL: 3600,
            urgency: payload.urgency ?? "high",
          }
        )
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        // 404/410: the browser dropped the subscription. 400 with a bad key
        // means the stored keys no longer match — both are unrecoverable here.
        if (statusCode === 410 || statusCode === 404) {
          deadIds.push(s.id as string)
        } else {
          failed++
          console.error(
            `[Push] Send failed (HTTP ${statusCode ?? "?"}):`,
            (err as Error)?.message ?? err
          )
        }
      }
    })
  )

  if (deadIds.length > 0) {
    await supabase.from("crm_push_subscriptions").delete().in("id", deadIds)
  }

  if (sent === 0) {
    console.error(
      `[Push] Nothing delivered — ${deadIds.length} dead, ${failed} failed of ${subs.length} subscriptions.`
    )
  }

  return { sent, pruned: deadIds.length, failed }
}

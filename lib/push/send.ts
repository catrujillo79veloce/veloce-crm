// ---------------------------------------------------------------------------
// Web Push sender.
//
// Sends push notifications to all stored subscriptions (or a specific user's).
// Prunes dead subscriptions (410/404) automatically.
// ---------------------------------------------------------------------------

import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys not configured")
    return false
  }
  const subject = process.env.VAPID_SUBJECT ?? "mailto:gerencia@veloce.com.co"
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a push to every subscribed device. If authUserId is given, only that
 * user's devices receive it; otherwise all team members do.
 */
export async function sendPush(
  payload: PushPayload,
  authUserId?: string
): Promise<{ sent: number; pruned: number }> {
  if (!ensureConfigured()) return { sent: 0, pruned: 0 }

  const supabase = createAdminClient()
  let query = supabase
    .from("crm_push_subscriptions")
    .select("id, endpoint, p256dh, auth")

  if (authUserId) query = query.eq("auth_user_id", authUserId)

  const { data: subs } = await query
  if (!subs || subs.length === 0) return { sent: 0, pruned: 0 }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/inbox",
    tag: payload.tag,
  })

  let sent = 0
  let pruned = 0
  const deadIds: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          },
          body
        )
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          deadIds.push(s.id as string)
        } else {
          console.error("[Push] Send error:", statusCode ?? err)
        }
      }
    })
  )

  if (deadIds.length > 0) {
    await supabase.from("crm_push_subscriptions").delete().in("id", deadIds)
    pruned = deadIds.length
  }

  return { sent, pruned }
}

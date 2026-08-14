"use client"

// ---------------------------------------------------------------------------
// InboxAlerts — the CRM-wide "someone just wrote you" layer.
//
// Before this existed, the only live signal lived inside the /inbox page, so a
// message that arrived while you were on the dashboard, the agenda or the
// workshop board produced nothing at all. This provider mounts once in the CRM
// layout and stays subscribed on every screen:
//
//   · system notification when the tab is hidden or you're not in the inbox
//   · in-app toast + sound when you are looking at the app
//   · unread badge on the sidebar and the mobile tab bar
//   · title flash so a background tab is visibly waiting
//
// It also owns read-state: opening a conversation stamps inbox_read_at, which
// is what makes the badge trustworthy.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import { useToast } from "@/components/ui/Toast"
import { useLiveTable } from "@/lib/realtime/useLiveTable"
import { getUnreadCount, markConversationRead } from "@/app/actions/inbox"
import { createClient } from "@/lib/supabase/client"

const MESSAGE_TYPES = [
  "whatsapp_message",
  "facebook_message",
  "instagram_message",
]

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp_message: "WhatsApp",
  facebook_message: "Facebook",
  instagram_message: "Instagram",
}

const CHANNEL_EMOJI: Record<string, string> = {
  whatsapp_message: "💬",
  facebook_message: "💙",
  instagram_message: "📸",
}

interface InboxAlertsValue {
  unread: number
  /** Mark a conversation as seen by a human (optimistic + persisted). */
  markRead: (contactId: string) => void
  refresh: () => void
}

const InboxAlertsContext = createContext<InboxAlertsValue>({
  unread: 0,
  markRead: () => {},
  refresh: () => {},
})

export function useInboxAlerts(): InboxAlertsValue {
  return useContext(InboxAlertsContext)
}

// ---------------------------------------------------------------------------
// Sound — one AudioContext for the whole session, unlocked on the first user
// gesture. The old code built a fresh AudioContext per message, which browsers
// suspend before it ever plays (and leaks one context per notification).
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (audioCtx) return audioCtx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  try {
    audioCtx = new Ctx()
  } catch {
    return null
  }
  return audioCtx
}

function playPing() {
  const ctx = getAudioContext()
  if (!ctx) return
  const start = () => {
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(880, ctx.currentTime)
      o.frequency.setValueAtTime(1180, ctx.currentTime + 0.12)
      g.gain.setValueAtTime(0.2, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      o.connect(g)
      g.connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 0.35)
    } catch {
      /* audio is a nicety, never a failure */
    }
  }
  if (ctx.state === "suspended") {
    ctx.resume().then(start).catch(() => {})
  } else {
    start()
  }
}

// ---------------------------------------------------------------------------
// System notification — routed through the service worker when one is active
// (Android and installed PWAs require that path), falling back to the plain
// Notification constructor on desktop.
// ---------------------------------------------------------------------------

async function showSystemNotification(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  const options: NotificationOptions = {
    body,
    tag,
    icon: "/icons/192",
    badge: "/icons/192",
    data: { url: "/inbox" },
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, { ...options, renotify: true } as NotificationOptions)
        return
      }
    }
    new Notification(title, options)
  } catch {
    /* notification blocked — the toast and badge still fire */
  }
}

// ---------------------------------------------------------------------------
// Title flash — a background tab should look like it wants attention.
// ---------------------------------------------------------------------------

function useTitleFlash(unread: number, pathname: string) {
  useEffect(() => {
    // Re-derive the base on navigation too, otherwise a later unread change
    // would restore the previous page's title.
    const base = document.title.replace(/^\(\d+\)\s*/, "")
    document.title = unread > 0 ? `(${unread}) ${base}` : base
    return () => {
      document.title = base
    }
  }, [unread, pathname])
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function InboxAlertsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [unread, setUnread] = useState(0)
  const { toast } = useToast()
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  // Rows already announced, so a reconnect replaying an insert can't ping twice.
  const seenRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(() => {
    getUnreadCount()
      .then(setUnread)
      .catch((e) => console.error("[InboxAlerts] unread refresh failed:", e))
  }, [])

  const markRead = useCallback((contactId: string) => {
    setUnread((n) => Math.max(0, n - 1))
    markConversationRead(contactId)
      .then(() => getUnreadCount())
      .then(setUnread)
      .catch((e) => console.error("[InboxAlerts] markRead failed:", e))
  }, [])

  // Unlock audio on the first interaction of the session so the ping is
  // actually audible when a message lands later.
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioContext()
      if (ctx?.state === "suspended") ctx.resume().catch(() => {})
    }
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const handleInsert = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (row: any) => {
      if (!MESSAGE_TYPES.includes(row.type)) return
      if (row.direction !== "inbound") return
      if (seenRef.current.has(row.id)) return
      seenRef.current.add(row.id)
      // Bound the dedup set so a long-lived tab doesn't grow forever.
      if (seenRef.current.size > 500) {
        seenRef.current = new Set(Array.from(seenRef.current).slice(-250))
      }

      setUnread((n) => n + 1)
      playPing()

      // Resolve the sender's name for a notification worth reading.
      let name = "Mensaje nuevo"
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("crm_contacts")
          .select("first_name, last_name")
          .eq("id", row.contact_id)
          .single()
        if (data) {
          name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || name
        }
      } catch {
        /* fall back to the generic title */
      }

      const emoji = CHANNEL_EMOJI[row.type] ?? "💬"
      const channel = CHANNEL_LABEL[row.type] ?? "Mensaje"
      const preview: string =
        (row.body && String(row.body).slice(0, 140)) ||
        (row.media_type ? `Envió ${row.media_type}` : "Mensaje nuevo")

      const inInbox = pathRef.current.startsWith("/inbox")
      const hidden = document.visibilityState !== "visible"

      if (hidden || !inInbox) {
        void showSystemNotification(
          `${emoji} ${name}`,
          preview,
          `contact-${row.contact_id}`
        )
      }
      if (!hidden && !inInbox) {
        toast("info", `${emoji} ${name} escribió por ${channel}`)
      }
    },
    [toast]
  )

  const status = useLiveTable({
    channel: "crm-inbox-alerts",
    table: "crm_interactions",
    onInsert: handleInsert,
    onResync: refresh,
    pollMs: 45_000,
  })

  // Surface a hard outage once, rather than letting the app look "quiet".
  const warnedRef = useRef(false)
  useEffect(() => {
    if (status === "offline" && !warnedRef.current) {
      warnedRef.current = true
      toast(
        "warning",
        "Conexión en vivo perdida — reintentando. La bandeja se actualiza igual cada 45 s."
      )
    }
    if (status === "live") warnedRef.current = false
  }, [status, toast])

  useTitleFlash(unread, pathname)

  return (
    <InboxAlertsContext.Provider value={{ unread, markRead, refresh }}>
      {children}
    </InboxAlertsContext.Provider>
  )
}

"use client"

// ---------------------------------------------------------------------------
// useLiveTable — a Supabase Realtime subscription that survives real life.
//
// The plain `.subscribe()` call the CRM used before had no failure handling:
// when the websocket dropped (phone screen off, wifi → data, laptop sleep,
// Supabase redeploy) the channel closed silently and the UI simply stopped
// updating. Nothing reconnected and nothing backfilled the rows missed while
// offline, so the only way to see new messages was to reload the page.
//
// This hook adds the three things that were missing:
//   1. status handling + exponential-backoff reconnect
//   2. a resync callback fired on every (re)connect, tab focus and network
//      recovery — so gaps are backfilled from the server, not guessed
//   3. a slow safety poll while the tab is visible, so even a permanently
//      broken websocket degrades to "a few seconds late" instead of "frozen"
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export type LiveStatus = "connecting" | "live" | "reconnecting" | "offline"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

interface Options {
  /** Unique channel name. Two components must not share one. */
  channel: string
  table: string
  /** Postgres filter, e.g. `contact_id=eq.${id}` */
  filter?: string
  onInsert?: (row: Row) => void
  onUpdate?: (row: Row) => void
  /**
   * Refetch authoritative state from the server. Called on every successful
   * (re)connect, when the tab regains focus, when the network comes back, and
   * on the safety poll. Must be idempotent.
   */
  onResync?: () => void | Promise<void>
  /** Safety poll interval while visible. 0 disables it. Default 45s. */
  pollMs?: number
  enabled?: boolean
}

const MAX_BACKOFF_MS = 30_000

export function useLiveTable({
  channel: channelName,
  table,
  filter,
  onInsert,
  onUpdate,
  onResync,
  pollMs = 45_000,
  enabled = true,
}: Options): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting")

  // Handlers live in refs so the subscription is never torn down just because
  // a parent re-rendered with new closures.
  const insertRef = useRef(onInsert)
  const updateRef = useRef(onUpdate)
  const resyncRef = useRef(onResync)
  insertRef.current = onInsert
  updateRef.current = onUpdate
  resyncRef.current = onResync

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let retries = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let disposed = false
    // Guards against overlapping refetches when focus + reconnect + poll all
    // fire within the same instant.
    let resyncing = false

    async function resync() {
      if (disposed || resyncing || !resyncRef.current) return
      resyncing = true
      try {
        await resyncRef.current()
      } catch (e) {
        console.error(`[Realtime:${channelName}] resync failed:`, e)
      } finally {
        resyncing = false
      }
    }

    function teardown() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    function scheduleReconnect() {
      if (disposed || reconnectTimer) return
      const delay = Math.min(1000 * 2 ** retries, MAX_BACKOFF_MS)
      retries++
      setStatus(retries > 2 ? "offline" : "reconnecting")
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    function connect() {
      if (disposed) return
      teardown()

      const postgresConfig = {
        schema: "public",
        table,
        ...(filter ? { filter } : {}),
      }

      const ch = supabase.channel(channelName)

      ch.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", ...postgresConfig },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => insertRef.current?.(payload.new as Row)
      )

      if (updateRef.current) {
        ch.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "UPDATE", ...postgresConfig },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => updateRef.current?.(payload.new as Row)
        )
      }

      ch.subscribe((state, err) => {
        if (disposed) return
        if (state === "SUBSCRIBED") {
          retries = 0
          setStatus("live")
          // Backfill whatever landed while we were disconnected.
          void resync()
          return
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          if (err) console.warn(`[Realtime:${channelName}] ${state}:`, err.message)
          scheduleReconnect()
        }
      })

      channel = ch
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return
      // Coming back from a locked phone: always re-pull, and if the socket
      // died while we were away, restart it immediately instead of waiting
      // out the backoff.
      void resync()
      if (channel?.state !== "joined") {
        retries = 0
        connect()
      }
    }

    function onOnline() {
      retries = 0
      connect()
    }

    function onOffline() {
      setStatus("offline")
    }

    connect()

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    if (pollMs > 0) {
      pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") void resync()
      }, pollMs)
    }

    return () => {
      disposed = true
      teardown()
      if (pollTimer) clearInterval(pollTimer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
    // Re-subscribe only when the identity of the subscription changes.
  }, [channelName, table, filter, pollMs, enabled])

  return status
}

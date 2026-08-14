"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Inbox, MessageSquare, ArrowLeft, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui"
import { useLiveTable } from "@/lib/realtime/useLiveTable"
import { useInboxAlerts } from "@/components/notifications/InboxAlerts"
import { refreshConversations } from "@/app/actions/inbox"
import { isUnread } from "@/lib/inbox/shared"
import ConversationList from "./ConversationList"
import ConversationThread from "./ConversationThread"
import type { ConversationSummary } from "@/lib/inbox/shared"
import type { Contact, Interaction, InteractionType } from "@/lib/types"
import type { MentionablePerson } from "./MentionPicker"

type ChannelFilter = "all" | "whatsapp_message" | "facebook_message" | "instagram_message"

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "whatsapp_message", label: "WhatsApp" },
  { value: "facebook_message", label: "Facebook" },
  { value: "instagram_message", label: "Instagram" },
]

const MESSAGE_TYPES: InteractionType[] = [
  "whatsapp_message",
  "facebook_message",
  "instagram_message",
]

interface InboxViewProps {
  initialConversations: ConversationSummary[]
  teamMembers: MentionablePerson[]
}

// ---------------------------------------------------------------------------
// InboxView
// ---------------------------------------------------------------------------

export default function InboxView({
  initialConversations,
  teamMembers,
}: InboxViewProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialConversations[0]?.contact.id ?? null
  )
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all")
  const [syncing, setSyncing] = useState(false)
  const { markRead } = useInboxAlerts()

  // Keep latest state accessible inside the realtime callback without
  // re-subscribing on every render.
  const selectedRef = useRef(selectedContactId)
  useEffect(() => {
    selectedRef.current = selectedContactId
  }, [selectedContactId])

  // -------------------------------------------------------------------------
  // Authoritative re-sync. Runs on every (re)connect, on tab focus, when the
  // network returns and on a slow poll — so a dropped websocket can no longer
  // strand the list until someone reloads the page.
  // -------------------------------------------------------------------------
  const resync = useCallback(async () => {
    setSyncing(true)
    try {
      const fresh = await refreshConversations()
      // Preserve the locally-cleared unread state of the conversation the user
      // is reading right now, so a poll can't make the badge reappear.
      const openId = selectedRef.current
      setConversations(
        fresh.map((c) =>
          c.contact.id === openId ? { ...c, unreadCount: 0 } : c
        )
      )
    } catch (e) {
      console.error("[Inbox] resync failed:", e)
    } finally {
      setSyncing(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Realtime: live-update conversation list when new interactions land
  // -------------------------------------------------------------------------
  const handleInsert = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (raw: any) => {
      const row = raw as Interaction & { contact_id: string }

      // Only message-type interactions go in the inbox
      if (!MESSAGE_TYPES.includes(row.type)) return

      const isOpenAndWatched =
        row.contact_id === selectedRef.current &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.contact.id === row.contact_id)

        if (idx >= 0) {
          // Existing conversation — bump it to the top + update last interaction
          const updated = [...prev]
          const existing = updated[idx]
          const counts = isUnread(row, existing.contact.inbox_read_at)
          updated.splice(idx, 1)
          return [
            {
              ...existing,
              lastInteraction: row as Interaction,
              unreadCount: isOpenAndWatched
                ? 0
                : existing.unreadCount + (counts ? 1 : 0),
            },
            ...updated,
          ]
        }

        // First message from a contact we don't have loaded yet: pull the
        // authoritative list rather than assembling a half-row client-side.
        void resync()
        return prev
      })

      // The conversation is open on screen — treat it as seen immediately.
      if (isOpenAndWatched) markRead(row.contact_id)
    },
    [markRead, resync]
  )

  const status = useLiveTable({
    channel: "inbox-interactions",
    table: "crm_interactions",
    onInsert: handleInsert,
    onResync: resync,
    pollMs: 30_000,
  })

  // Sync contact-level changes (ai_enabled auto-pause, assignment, avatar).
  useLiveTable({
    channel: "inbox-contacts",
    table: "crm_contacts",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdate: useCallback((raw: any) => {
      const updated = raw as Contact
      setConversations((prev) =>
        prev.map((c) =>
          c.contact.id === updated.id
            ? { ...c, contact: { ...c.contact, ...updated } }
            : c
        )
      )
    }, []),
    pollMs: 0,
  })

  const filteredConversations = conversations.filter((conv) => {
    if (channelFilter === "all") return true
    return conv.lastInteraction.type === channelFilter
  })

  const selectedConversation = conversations.find(
    (c) => c.contact.id === selectedContactId
  )

  const handleSelectConversation = useCallback(
    (contactId: string) => {
      setSelectedContactId(contactId)
      // Clear unread count for the conversation we're opening, and persist it
      // so the badge stays cleared across reloads and other devices.
      setConversations((prev) =>
        prev.map((c) =>
          c.contact.id === contactId ? { ...c, unreadCount: 0 } : c
        )
      )
      markRead(contactId)
    },
    [markRead]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Bandeja de Entrada
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{conversations.length} conversaciones</span>
            <ConnectionPill status={status} syncing={syncing} onRetry={resync} />
          </div>
        </div>

        {/* Channel filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {CHANNEL_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setChannelFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                channelFilter === filter.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split panel */}
      {conversations.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-12 h-12" />}
          title="Sin conversaciones"
          description="Las conversaciones de WhatsApp, Facebook e Instagram aparaceran aqui."
        />
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Left panel - conversation list.
              On mobile: full width, but hidden once a conversation is open. */}
          <div
            className={cn(
              "w-full md:w-1/3 border-r border-gray-200 flex-col min-h-0",
              selectedContactId ? "hidden md:flex" : "flex"
            )}
          >
            <ConversationList
              conversations={filteredConversations}
              selectedContactId={selectedContactId}
              teamMembers={teamMembers}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Right panel - conversation thread.
              On mobile: hidden until a conversation is selected, then full width. */}
          <div
            className={cn(
              "w-full md:w-2/3 flex-col min-h-0",
              selectedConversation ? "flex" : "hidden md:flex"
            )}
          >
            {selectedConversation ? (
              <>
                {/* Mobile-only back button */}
                <button
                  onClick={() => setSelectedContactId(null)}
                  className="md:hidden flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-veloce-700 border-b border-gray-100 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Conversaciones
                </button>
                <div className="flex-1 min-h-0">
                  <ConversationThread
                    contact={selectedConversation.contact}
                    channelType={selectedConversation.lastInteraction.type}
                    teamMembers={teamMembers}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Selecciona una conversacion</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connection indicator — makes the live link visible instead of leaving the
// operator guessing whether "no messages" means calm or broken.
// ---------------------------------------------------------------------------

function ConnectionPill({
  status,
  syncing,
  onRetry,
}: {
  status: "connecting" | "live" | "reconnecting" | "offline"
  syncing: boolean
  onRetry: () => void
}) {
  if (status === "live") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-green-600"
        title="Los mensajes nuevos aparecen solos"
      >
        <Wifi className="w-3.5 h-3.5" />
        {syncing ? "Actualizando…" : "En vivo"}
      </span>
    )
  }

  return (
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
      title="Sin conexión en vivo. Toca para actualizar ahora."
    >
      {status === "offline" ? (
        <WifiOff className="w-3.5 h-3.5" />
      ) : (
        <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
      )}
      {status === "offline" ? "Sin conexión" : "Reconectando…"}
    </button>
  )
}

"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Inbox, MessageSquare, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui"
import { createClient } from "@/lib/supabase/client"
import ConversationList from "./ConversationList"
import ConversationThread from "./ConversationThread"
import type { ConversationSummary } from "@/app/(crm)/inbox/page"
import type { Contact, Interaction, InteractionType } from "@/lib/types"

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
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

function flashTitle(text: string) {
  if (typeof document === "undefined") return
  const original = document.title
  let toggled = false
  const interval = setInterval(() => {
    document.title = toggled ? original : text
    toggled = !toggled
  }, 1000)
  setTimeout(() => {
    clearInterval(interval)
    document.title = original
  }, 8000)
}

function playPing() {
  if (typeof window === "undefined") return
  try {
    // Tiny synthesized "ding" via Web Audio — no asset needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = "sine"
    o.frequency.value = 880
    g.gain.setValueAtTime(0.18, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.3)
  } catch {
    // Browsers block AudioContext if no user gesture has happened yet — silent fail
  }
}

// ---------------------------------------------------------------------------
// InboxView
// ---------------------------------------------------------------------------

export default function InboxView({ initialConversations }: InboxViewProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialConversations[0]?.contact.id ?? null
  )
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all")

  // Keep latest state accessible inside the realtime callback without
  // re-subscribing on every render.
  const selectedRef = useRef(selectedContactId)
  useEffect(() => {
    selectedRef.current = selectedContactId
  }, [selectedContactId])

  // -------------------------------------------------------------------------
  // Realtime: live-update conversation list when new interactions land
  // -------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("inbox-interactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crm_interactions",
        },
        async (payload) => {
          const row = payload.new as Interaction & { contact_id: string }

          // Only message-type interactions go in the inbox
          if (!MESSAGE_TYPES.includes(row.type)) return

          // Notify the human if it's an inbound message
          if (row.direction === "inbound") {
            playPing()
            flashTitle("💬 Nuevo mensaje")
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.contact.id === row.contact_id)

            if (idx >= 0) {
              // Existing conversation — bump it to the top + update last interaction
              const updated = [...prev]
              const existing = updated[idx]
              const newUnread =
                row.direction === "inbound" && !row.team_member_id
                  ? existing.unreadCount + 1
                  : existing.unreadCount
              updated.splice(idx, 1)
              return [
                {
                  ...existing,
                  lastInteraction: row as Interaction,
                  unreadCount:
                    row.contact_id === selectedRef.current ? 0 : newUnread,
                },
                ...updated,
              ]
            }

            // New contact — fetch its profile so we can render it
            void (async () => {
              const { data: contact } = await supabase
                .from("crm_contacts")
                .select(
                  "id, first_name, last_name, email, phone, whatsapp_phone, facebook_id, instagram_id, source, avatar_url, status, ai_enabled, ai_paused_at"
                )
                .eq("id", row.contact_id)
                .single()
              if (!contact) return
              setConversations((curr) => {
                // Avoid double-insert if another event already added it
                if (curr.some((c) => c.contact.id === contact.id)) return curr
                return [
                  {
                    contact: contact as unknown as Contact,
                    lastInteraction: row as Interaction,
                    unreadCount: row.direction === "inbound" ? 1 : 0,
                  },
                  ...curr,
                ]
              })
            })()
            return prev
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crm_contacts",
        },
        (payload) => {
          // Sync ai_enabled changes (e.g., auto-pause when human sends)
          const updated = payload.new as Contact
          setConversations((prev) =>
            prev.map((c) =>
              c.contact.id === updated.id
                ? {
                    ...c,
                    contact: { ...c.contact, ...updated },
                  }
                : c
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredConversations = conversations.filter((conv) => {
    if (channelFilter === "all") return true
    return conv.lastInteraction.type === channelFilter
  })

  const selectedConversation = conversations.find(
    (c) => c.contact.id === selectedContactId
  )

  const handleSelectConversation = useCallback((contactId: string) => {
    setSelectedContactId(contactId)
    // Clear unread count for the conversation we're opening
    setConversations((prev) =>
      prev.map((c) =>
        c.contact.id === contactId ? { ...c, unreadCount: 0 } : c
      )
    )
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Bandeja de Entrada
          </h1>
          <p className="text-sm text-gray-500">
            {conversations.length} conversaciones
          </p>
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

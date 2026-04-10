"use client"

import { useState, useCallback } from "react"
import { Inbox, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui"
import ConversationList from "./ConversationList"
import ConversationThread from "./ConversationThread"
import type { ConversationSummary } from "@/app/(crm)/inbox/page"

type ChannelFilter = "all" | "whatsapp_message" | "facebook_message" | "instagram_message"

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "whatsapp_message", label: "WhatsApp" },
  { value: "facebook_message", label: "Facebook" },
  { value: "instagram_message", label: "Instagram" },
]

interface InboxViewProps {
  initialConversations: ConversationSummary[]
}

export default function InboxView({ initialConversations }: InboxViewProps) {
  const [conversations] = useState(initialConversations)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialConversations[0]?.contact.id ?? null
  )
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all")

  const filteredConversations = conversations.filter((conv) => {
    if (channelFilter === "all") return true
    return conv.lastInteraction.type === channelFilter
  })

  const selectedConversation = conversations.find(
    (c) => c.contact.id === selectedContactId
  )

  const handleSelectConversation = useCallback((contactId: string) => {
    setSelectedContactId(contactId)
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
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Left panel - conversation list */}
          <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col min-h-0">
            <ConversationList
              conversations={filteredConversations}
              selectedContactId={selectedContactId}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Right panel - conversation thread */}
          <div className="hidden md:flex md:w-2/3 flex-col min-h-0">
            {selectedConversation ? (
              <ConversationThread
                contact={selectedConversation.contact}
                channelType={selectedConversation.lastInteraction.type}
              />
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

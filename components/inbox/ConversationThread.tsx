"use client"

import { useState, useEffect, useRef } from "react"
import { MessageCircle, MessageSquare, Camera, User, ExternalLink } from "lucide-react"
import { cn, formatDateTime } from "@/lib/utils"
import { Avatar, LoadingSpinner } from "@/components/ui"
import { createClient } from "@/lib/supabase/client"
import MessageComposer from "./MessageComposer"
import type { Contact, Interaction, InteractionType } from "@/lib/types"

// ---------------------------------------------------------------------------
// Channel badge helper
// ---------------------------------------------------------------------------

function ChannelBadgeInline({ type }: { type: InteractionType }) {
  switch (type) {
    case "whatsapp_message":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
          <MessageCircle className="w-3 h-3" /> WhatsApp
        </span>
      )
    case "facebook_message":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
          <MessageSquare className="w-3 h-3" /> Facebook
        </span>
      )
    case "instagram_message":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-600">
          <Camera className="w-3 h-3" /> Instagram
        </span>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// ConversationThread
// ---------------------------------------------------------------------------

interface ConversationThreadProps {
  contact: Contact
  channelType: InteractionType
}

export default function ConversationThread({
  contact,
  channelType,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages for this contact
  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("crm_interactions")
        .select(
          `
          *,
          team_member:crm_team_members!crm_interactions_team_member_id_fkey(id, full_name, avatar_url)
        `
        )
        .eq("contact_id", contact.id)
        .in("type", [
          "whatsapp_message",
          "facebook_message",
          "instagram_message",
        ])
        .order("occurred_at", { ascending: true })
        .limit(100)

      if (!cancelled) {
        if (error) {
          console.error("Load messages error:", error)
          setMessages([])
        } else {
          setMessages(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (data ?? []).map((row: any) => ({
              ...row,
              team_member: row.team_member ?? undefined,
            }))
          )
        }
        setLoading(false)
      }
    }

    loadMessages()
    return () => {
      cancelled = true
    }
  }, [contact.id])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle new message sent
  const handleMessageSent = (newMessage: Interaction) => {
    setMessages((prev) => [...prev, newMessage])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Contact header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <Avatar
          src={contact.avatar_url}
          firstName={contact.first_name}
          lastName={contact.last_name}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {contact.first_name} {contact.last_name}
            </h3>
            <ChannelBadgeInline type={channelType} />
          </div>
          <p className="text-xs text-gray-500 truncate">
            {contact.whatsapp_phone || contact.phone || contact.email || ""}
          </p>
        </div>
        <a
          href={`/contacts/${contact.id}`}
          className="flex items-center gap-1 text-xs text-veloce-600 hover:text-veloce-700 transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          Ver perfil
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Sin mensajes
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === "outbound"

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isOutbound ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5",
                    isOutbound
                      ? "bg-green-100 text-green-900 rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md"
                  )}
                >
                  {/* Sender name for outbound */}
                  {isOutbound && msg.team_member && (
                    <p className="text-xs font-medium text-green-700 mb-0.5">
                      {msg.team_member.full_name}
                    </p>
                  )}

                  {/* Message body */}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.body}
                  </p>

                  {/* Timestamp */}
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      isOutbound ? "text-green-600" : "text-gray-400"
                    )}
                  >
                    {formatDateTime(msg.occurred_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message composer */}
      <MessageComposer
        contact={contact}
        channelType={channelType}
        onMessageSent={handleMessageSent}
      />
    </div>
  )
}

"use client"

import { MessageCircle, MessageSquare, Camera } from "lucide-react"
import { cn, truncate, formatRelativeTime } from "@/lib/utils"
import { Avatar } from "@/components/ui"
import type { ConversationSummary } from "@/app/(crm)/inbox/page"
import type { InteractionType } from "@/lib/types"

// ---------------------------------------------------------------------------
// Channel icon helper
// ---------------------------------------------------------------------------

function ChannelIcon({ type, className }: { type: InteractionType; className?: string }) {
  switch (type) {
    case "whatsapp_message":
      return <MessageCircle className={cn("text-green-500", className)} />
    case "facebook_message":
      return <MessageSquare className={cn("text-blue-600", className)} />
    case "instagram_message":
      return <Camera className={cn("text-pink-500", className)} />
    default:
      return <MessageCircle className={cn("text-gray-400", className)} />
  }
}

// ---------------------------------------------------------------------------
// ConversationList
// ---------------------------------------------------------------------------

interface ConversationListProps {
  conversations: ConversationSummary[]
  selectedContactId: string | null
  onSelect: (contactId: string) => void
}

export default function ConversationList({
  conversations,
  selectedContactId,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const { contact, lastInteraction, unreadCount } = conv
        const isSelected = contact.id === selectedContactId
        const isUnread = unreadCount > 0

        return (
          <button
            key={contact.id}
            onClick={() => onSelect(contact.id)}
            className={cn(
              "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100",
              isSelected
                ? "bg-veloce-50"
                : "hover:bg-gray-50",
            )}
          >
            {/* Avatar */}
            <Avatar
              src={contact.avatar_url}
              firstName={contact.first_name}
              lastName={contact.last_name}
              size="md"
              className="flex-shrink-0 mt-0.5"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm truncate",
                    isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                  )}
                >
                  {contact.first_name} {contact.last_name}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatRelativeTime(lastInteraction.occurred_at)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                <ChannelIcon
                  type={lastInteraction.type}
                  className="w-3.5 h-3.5 flex-shrink-0"
                />
                <span
                  className={cn(
                    "text-xs truncate",
                    isUnread ? "font-medium text-gray-700" : "text-gray-500"
                  )}
                >
                  {lastInteraction.direction === "outbound" && "Tu: "}
                  {truncate(lastInteraction.body ?? "", 50)}
                </span>
              </div>
            </div>

            {/* Unread badge */}
            {isUnread && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-veloce-500 text-white text-xs flex items-center justify-center mt-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        )
      })}

      {conversations.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          Sin conversaciones en este canal
        </div>
      )}
    </div>
  )
}

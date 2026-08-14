"use client"

import { MessageCircle, MessageSquare, Camera, BotOff } from "lucide-react"
import { cn, truncate, formatRelativeTime } from "@/lib/utils"
import { Avatar } from "@/components/ui"
import type { ConversationSummary } from "@/lib/inbox/shared"
import type { Interaction, InteractionType } from "@/lib/types"
import type { MentionablePerson } from "./MentionPicker"

// Build a preview string for the conversation list, handling media-only msgs.
function previewFor(interaction: Interaction): string {
  if (interaction.body) return truncate(interaction.body, 50)
  if (interaction.transcription) return `🎤 ${truncate(interaction.transcription, 45)}`
  if (interaction.vision_caption) return `📷 ${truncate(interaction.vision_caption, 45)}`
  switch (interaction.media_type) {
    case "image":
      return "📷 Foto"
    case "audio":
      return "🎤 Audio"
    case "video":
      return "🎬 Video"
    case "document":
      return "📄 Documento"
    case "sticker":
      return "✨ Sticker"
    default:
      return ""
  }
}

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
  teamMembers: MentionablePerson[]
  onSelect: (contactId: string) => void
}

export default function ConversationList({
  conversations,
  selectedContactId,
  teamMembers,
  onSelect,
}: ConversationListProps) {
  const memberById = new Map(teamMembers.map((m) => [m.id, m]))
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
            {/* Avatar with assignee dot */}
            <div className="relative flex-shrink-0 mt-0.5">
              <Avatar
                src={contact.avatar_url}
                firstName={contact.first_name}
                lastName={contact.last_name}
                size="md"
              />
              {contact.assigned_to && memberById.get(contact.assigned_to) && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white"
                  title={`Asignado a ${memberById.get(contact.assigned_to)!.full_name}`}
                >
                  <Avatar
                    src={memberById.get(contact.assigned_to)!.avatar_url}
                    firstName={
                      memberById.get(contact.assigned_to)!.full_name.split(" ")[0]
                    }
                    lastName={
                      memberById.get(contact.assigned_to)!.full_name.split(" ")[1] ?? ""
                    }
                    size="xs"
                  />
                </div>
              )}
            </div>

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
                  {previewFor(lastInteraction)}
                </span>
                {contact.ai_enabled === false && (
                  <span
                    title="IA pausada para este contacto"
                    className="ml-auto flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 flex-shrink-0"
                  >
                    <BotOff className="w-3 h-3" />
                  </span>
                )}
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

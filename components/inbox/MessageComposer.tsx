"use client"

import { useState, useRef, useCallback } from "react"
import { Send, MessageCircle, MessageSquare, Camera, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Contact, Interaction, InteractionType } from "@/lib/types"

// ---------------------------------------------------------------------------
// Channel support map
// ---------------------------------------------------------------------------

const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; canSend: boolean }
> = {
  whatsapp_message: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-500",
    canSend: true,
  },
  facebook_message: {
    label: "Facebook",
    icon: MessageSquare,
    color: "text-blue-600",
    canSend: false, // Placeholder - outbound not implemented yet
  },
  instagram_message: {
    label: "Instagram",
    icon: Camera,
    color: "text-pink-500",
    canSend: false, // Placeholder - outbound not implemented yet
  },
}

// ---------------------------------------------------------------------------
// MessageComposer
// ---------------------------------------------------------------------------

interface MessageComposerProps {
  contact: Contact
  channelType: InteractionType
  onMessageSent: (message: Interaction) => void
}

export default function MessageComposer({
  contact,
  channelType,
  onMessageSent,
}: MessageComposerProps) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const channel = CHANNEL_CONFIG[channelType] ?? CHANNEL_CONFIG.whatsapp_message
  const ChannelIcon = channel.icon

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError("")

    if (channelType === "whatsapp_message") {
      setSending(true)
      try {
        const response = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: contact.id,
            message: trimmed,
          }),
        })

        const result = await response.json()

        if (result.success) {
          // Create a local interaction object for immediate UI update
          const newInteraction: Interaction = {
            id: `temp-${Date.now()}`,
            contact_id: contact.id,
            lead_id: null,
            deal_id: null,
            type: "whatsapp_message",
            direction: "outbound",
            subject: null,
            body: trimmed,
            channel_message_id: null,
            channel_metadata: null,
            team_member_id: null,
            occurred_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }
          onMessageSent(newInteraction)
          setText("")
          textareaRef.current?.focus()
        } else {
          setError(result.error || "Error al enviar")
        }
      } catch {
        setError("Error de conexion")
      } finally {
        setSending(false)
      }
    }
  }, [text, sending, channelType, contact.id, onMessageSent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!channel.canSend) {
    return (
      <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <AlertCircle className="w-4 h-4" />
          <span>
            El envio de mensajes por {channel.label} estara disponible
            proximamente.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
      {/* Error display */}
      {error && (
        <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Channel indicator */}
        <div className="flex-shrink-0 pb-1.5">
          <ChannelIcon className={cn("w-5 h-5", channel.color)} />
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 min-h-[36px] max-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-veloce-500 focus:outline-none focus:ring-1 focus:ring-veloce-500 resize-none"
          disabled={sending}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            text.trim() && !sending
              ? "bg-veloce-500 text-white hover:bg-veloce-600"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
          title="Enviar (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        Enter para enviar, Shift+Enter para nueva linea
      </p>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import {
  MessageCircle,
  MessageSquare,
  Camera,
  User,
  ExternalLink,
  Bot,
  BotOff,
  StickyNote,
  UserPlus,
  Check,
  X as XIcon,
} from "lucide-react"
import { cn, formatDateTime } from "@/lib/utils"
import { Avatar, LoadingSpinner } from "@/components/ui"
import { createClient } from "@/lib/supabase/client"
import MessageComposer from "./MessageComposer"
import MessageMedia from "./MessageMedia"
import ContactTagsBar from "./ContactTagsBar"
import { assignConversation } from "@/app/actions/conversations"
import type { MentionablePerson } from "./MentionPicker"
import type {
  Contact,
  Interaction,
  InteractionType,
  TeamMember,
} from "@/lib/types"

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

// Render the note body with @mentions highlighted in amber.
function renderNoteBody(body: string) {
  const parts = body.split(/(@[A-Za-zÀ-ÿ0-9_]+)/)
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span
        key={i}
        className="font-semibold text-amber-700 bg-amber-100 rounded px-0.5"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// ---------------------------------------------------------------------------
// ConversationThread
// ---------------------------------------------------------------------------

interface ConversationThreadProps {
  contact: Contact
  channelType: InteractionType
  teamMembers: MentionablePerson[]
}

export default function ConversationThread({
  contact,
  channelType,
  teamMembers,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [aiEnabled, setAiEnabled] = useState<boolean>(contact.ai_enabled ?? true)
  const [togglingAi, setTogglingAi] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(
    contact.assigned_to ?? null
  )
  const [assigning, setAssigning] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sync local state when the selected contact changes
  useEffect(() => {
    setAiEnabled(contact.ai_enabled ?? true)
    setAssignedTo(contact.assigned_to ?? null)
  }, [contact.id, contact.ai_enabled, contact.assigned_to])

  // Toggle AI auto-reply for this contact
  const toggleAi = async () => {
    if (togglingAi) return
    const next = !aiEnabled
    setTogglingAi(true)
    setAiEnabled(next)
    try {
      const response = await fetch(`/api/contacts/${contact.id}/toggle-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      const result = await response.json()
      if (!result.success) {
        setAiEnabled(!next)
        console.error("Toggle AI failed:", result.error)
      }
    } catch (e) {
      setAiEnabled(!next)
      console.error("Toggle AI error:", e)
    } finally {
      setTogglingAi(false)
    }
  }

  const handleAssign = async (memberId: string | null) => {
    if (assigning) return
    setAssigning(true)
    const prev = assignedTo
    setAssignedTo(memberId)
    setAssignOpen(false)
    try {
      const result = await assignConversation(contact.id, memberId)
      if (!result.success) {
        setAssignedTo(prev)
        console.error("assignConversation failed:", result.error)
      }
    } catch (e) {
      setAssignedTo(prev)
      console.error("assignConversation error:", e)
    } finally {
      setAssigning(false)
    }
  }

  const assignedMember =
    teamMembers.find((m) => m.id === assignedTo) ?? null

  // Load messages for this contact (channel messages + internal notes)
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
          "note",
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

  // Realtime: append new messages and internal notes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`thread-${contact.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crm_interactions",
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          const row = payload.new as Interaction
          const ALLOWED: InteractionType[] = [
            "whatsapp_message",
            "facebook_message",
            "instagram_message",
            "note",
          ]
          if (!ALLOWED.includes(row.type)) return
          setMessages((prev) => {
            const cleaned = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("temp-") &&
                  m.direction === row.direction &&
                  m.body === row.body &&
                  Math.abs(
                    new Date(m.occurred_at).getTime() -
                      new Date(row.occurred_at).getTime()
                  ) < 30000
                )
            )
            if (cleaned.some((m) => m.id === row.id)) return cleaned
            return [...cleaned, row]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [contact.id])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Close assign popover on outside click / Escape
  useEffect(() => {
    if (!assignOpen) return
    const close = () => setAssignOpen(false)
    window.addEventListener("click", close)
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("keydown", esc)
    }
  }, [assignOpen])

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
          <div className="mt-1.5">
            <ContactTagsBar contactId={contact.id} />
          </div>
        </div>

        {/* Assignment picker */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setAssignOpen((v) => !v)}
            disabled={assigning}
            title={
              assignedMember
                ? `Asignado a ${assignedMember.full_name}`
                : "Asignar a un miembro del equipo"
            }
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
              assignedMember
                ? "bg-veloce-50 text-veloce-700 border-veloce-200 hover:bg-veloce-100"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50",
              assigning && "opacity-60 cursor-wait"
            )}
          >
            {assignedMember ? (
              <>
                <Avatar
                  src={assignedMember.avatar_url}
                  firstName={assignedMember.full_name.split(" ")[0]}
                  lastName={assignedMember.full_name.split(" ")[1] ?? ""}
                  size="xs"
                />
                <span className="truncate max-w-[7rem]">
                  {assignedMember.full_name.split(" ")[0]}
                </span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Asignar
              </>
            )}
          </button>

          {assignOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                Asignar conversación
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                <li>
                  <button
                    onClick={() => handleAssign(null)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm",
                      !assignedTo
                        ? "bg-gray-50 text-gray-700"
                        : "hover:bg-gray-50 text-gray-600"
                    )}
                  >
                    <XIcon className="w-3.5 h-3.5 text-gray-400" />
                    Sin asignar
                    {!assignedTo && (
                      <Check className="w-3.5 h-3.5 ml-auto text-veloce-600" />
                    )}
                  </button>
                </li>
                {teamMembers.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => handleAssign(m.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm",
                        m.id === assignedTo
                          ? "bg-veloce-50 text-veloce-800"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <Avatar
                        src={m.avatar_url}
                        firstName={m.full_name.split(" ")[0]}
                        lastName={m.full_name.split(" ")[1] ?? ""}
                        size="sm"
                      />
                      <span className="truncate">{m.full_name}</span>
                      {m.id === assignedTo && (
                        <Check className="w-3.5 h-3.5 ml-auto text-veloce-600" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* AI auto-reply toggle */}
        <button
          onClick={toggleAi}
          disabled={togglingAi}
          title={
            aiEnabled
              ? "Pausar respuesta automatica de la IA para este contacto"
              : "Reanudar respuesta automatica de la IA"
          }
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
            aiEnabled
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
            togglingAi && "opacity-60 cursor-wait"
          )}
        >
          {aiEnabled ? (
            <>
              <Bot className="w-3.5 h-3.5" /> IA: ON
            </>
          ) : (
            <>
              <BotOff className="w-3.5 h-3.5" /> IA pausada
            </>
          )}
        </button>

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
            if (msg.type === "note") {
              return <InternalNoteBubble key={msg.id} note={msg} />
            }

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
                  {isOutbound && msg.team_member && (
                    <p className="text-xs font-medium text-green-700 mb-0.5">
                      {msg.team_member.full_name}
                    </p>
                  )}

                  {msg.media_url && msg.media_type && (
                    <MessageMedia
                      url={msg.media_url}
                      type={msg.media_type}
                      mime={msg.media_mime}
                      transcription={msg.transcription}
                      visionCaption={msg.vision_caption}
                      isOutbound={isOutbound}
                    />
                  )}

                  {msg.body && (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>
                  )}

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
        teamMembers={teamMembers}
        onMessageSent={handleMessageSent}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sticky-note bubble for internal notes
// ---------------------------------------------------------------------------

function InternalNoteBubble({ note }: { note: Interaction }) {
  const author = (note as Interaction & { team_member?: TeamMember }).team_member
  return (
    <div className="flex justify-center">
      <div className="max-w-[85%] rounded-xl px-3.5 py-2 bg-amber-50 border border-amber-200 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <StickyNote className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Nota interna
          </span>
          {author && (
            <span className="text-[11px] text-amber-700/80">
              · {author.full_name}
            </span>
          )}
        </div>
        {note.body && (
          <p className="text-sm whitespace-pre-wrap break-words text-amber-900">
            {renderNoteBody(note.body)}
          </p>
        )}
        <p className="text-[10px] mt-1 text-amber-600/70">
          {formatDateTime(note.occurred_at)}
        </p>
      </div>
    </div>
  )
}

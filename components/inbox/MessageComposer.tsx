"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Send,
  MessageCircle,
  MessageSquare,
  Camera,
  AlertCircle,
  Sparkles,
  Paperclip,
  X,
  Loader2,
  FileText,
  StickyNote,
  AtSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import CannedResponsesPicker from "./CannedResponsesPicker"
import ProductPickerPopover, { type PickedProduct } from "./ProductPickerPopover"
import EmojiPicker from "./EmojiPicker"
import MentionPicker, { type MentionablePerson } from "./MentionPicker"
import { Package, Smile } from "lucide-react"
import { addInternalNote } from "@/app/actions/conversations"
import type {
  CannedResponse,
  Contact,
  Interaction,
  InteractionType,
} from "@/lib/types"

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
    canSend: true,
  },
  instagram_message: {
    label: "Instagram",
    icon: Camera,
    color: "text-pink-500",
    canSend: true,
  },
}

// ---------------------------------------------------------------------------
// MessageComposer
// ---------------------------------------------------------------------------

interface MessageComposerProps {
  contact: Contact
  channelType: InteractionType
  teamMembers: MentionablePerson[]
  onMessageSent: (message: Interaction) => void
}

type Mode = "message" | "note"

export default function MessageComposer({
  contact,
  channelType,
  teamMembers,
  onMessageSent,
}: MessageComposerProps) {
  const [mode, setMode] = useState<Mode>("message")
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState("")
  const [uploading, setUploading] = useState(false)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set())
  const mentionStartRef = useRef<number | null>(null)
  const [signature, setSignature] = useState<{ text: string; enabled: boolean }>({
    text: "",
    enabled: false,
  })
  const [attachment, setAttachment] = useState<{
    url: string
    mime: string
    kind: string
    filename: string
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const channel = CHANNEL_CONFIG[channelType] ?? CHANNEL_CONFIG.whatsapp_message
  const ChannelIcon = channel.icon
  const isNote = mode === "note"

  // Load the optional manual-message signature once
  useEffect(() => {
    fetch("/api/settings/signature", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.enabled && d.text) {
          setSignature({ text: d.text, enabled: true })
        }
      })
      .catch(() => {})
  }, [])

  // Reset transient state when switching modes
  useEffect(() => {
    setError("")
    setMentionOpen(false)
    setPickerOpen(false)
    setProductPickerOpen(false)
    setEmojiOpen(false)
  }, [mode])

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = textareaRef.current
      if (!el) {
        setText((t) => t + emoji)
        return
      }
      const start = el.selectionStart ?? text.length
      const end = el.selectionEnd ?? text.length
      const next = text.slice(0, start) + emoji + text.slice(end)
      setText(next)
      setTimeout(() => {
        el.focus()
        const pos = start + emoji.length
        el.setSelectionRange(pos, pos)
      }, 0)
    },
    [text]
  )

  const handlePickProduct = useCallback((p: PickedProduct) => {
    const fmt = (n: number) => "$" + Number(n).toLocaleString("es-CO")
    const name = `${p.brand ? p.brand + " " : ""}${p.name}`
    const priceLine = p.sale_price
      ? `🔥 OFERTA: ${fmt(p.sale_price)} (antes ${fmt(p.price)})`
      : `💰 ${fmt(p.price)}`
    const lines = [`🚲 ${name}`, priceLine]
    if (p.external_url) lines.push(p.external_url)
    lines.push("¿Te interesa? Escríbenos o pásate por Veloce El Poblado 🙌")

    setText(lines.join("\n"))
    if (p.image_url) {
      setAttachment({
        url: p.image_url,
        mime: "image/jpeg",
        kind: "image",
        filename: `${p.name}.jpg`,
      })
    }
    setProductPickerOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setError("")
        setUploading(true)
        try {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("contactId", contact.id)
          const resp = await fetch("/api/media/upload", { method: "POST", body: fd })
          const data = await resp.json()
          if (!resp.ok) {
            setError(data.error || "Error subiendo el archivo")
          } else {
            setAttachment({
              url: data.url,
              mime: data.mime,
              kind: data.kind,
              filename: data.filename,
            })
          }
        } catch {
          setError("Error subiendo el archivo")
        } finally {
          setUploading(false)
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [contact.id]
  )

  // -------------------------------------------------------------------------
  // Mention autocomplete
  // -------------------------------------------------------------------------

  const detectMentionToken = useCallback(
    (value: string, cursor: number) => {
      const before = value.slice(0, cursor)
      // Token: "@..." preceded by start-of-text or whitespace, until cursor
      const m = /(?:^|\s)@([A-Za-zÀ-ÿ0-9_]*)$/.exec(before)
      if (!m) return null
      // m[1] is the partial query (may be empty if just typed "@")
      return { start: cursor - m[1].length - 1, query: m[1] }
    },
    []
  )

  const handlePickMention = useCallback(
    (member: MentionablePerson) => {
      const el = textareaRef.current
      const cursor = el?.selectionStart ?? text.length
      const start = mentionStartRef.current ?? cursor
      const firstName = member.full_name.split(" ")[0] ?? member.full_name
      const before = text.slice(0, start)
      const after = text.slice(cursor)
      const insertion = `@${firstName} `
      const newText = before + insertion + after
      setText(newText)
      setMentionedIds((prev) => new Set(prev).add(member.id))
      setMentionOpen(false)
      mentionStartRef.current = null
      setTimeout(() => {
        const pos = before.length + insertion.length
        el?.focus()
        el?.setSelectionRange(pos, pos)
      }, 0)
    },
    [text]
  )

  // -------------------------------------------------------------------------
  // Send / Save
  // -------------------------------------------------------------------------

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed && (isNote || !attachment)) return
    if (sending) return
    setError("")

    if (isNote) {
      setSending(true)
      try {
        const result = await addInternalNote(
          contact.id,
          trimmed,
          Array.from(mentionedIds)
        )
        if (result.success && result.interaction) {
          onMessageSent(result.interaction)
          setText("")
          setMentionedIds(new Set())
          textareaRef.current?.focus()
        } else {
          setError(result.error || "No se pudo guardar la nota")
        }
      } catch {
        setError("Error de conexión")
      } finally {
        setSending(false)
      }
      return
    }

    // Outgoing channel message
    const outgoing =
      trimmed && signature.enabled && signature.text
        ? `${trimmed}\n\n${signature.text}`
        : trimmed

    const apiEndpoint =
      channelType === "whatsapp_message"
        ? "/api/whatsapp/send"
        : channelType === "instagram_message"
          ? "/api/instagram/send"
          : channelType === "facebook_message"
            ? "/api/facebook/send"
            : null

    if (!apiEndpoint) return

    setSending(true)
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          message: outgoing,
          mediaUrl: attachment?.url,
          mediaKind: attachment?.kind,
          mediaMime: attachment?.mime,
          filename: attachment?.filename,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const newInteraction: Interaction = {
          id: `temp-${Date.now()}`,
          contact_id: contact.id,
          lead_id: null,
          deal_id: null,
          type: channelType,
          direction: "outbound",
          subject: null,
          body: outgoing,
          media_url: attachment?.url ?? null,
          media_type: attachment?.kind ?? null,
          media_mime: attachment?.mime ?? null,
          channel_message_id: null,
          channel_metadata: null,
          team_member_id: null,
          occurred_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
        onMessageSent(newInteraction)
        setText("")
        setAttachment(null)
        textareaRef.current?.focus()
      } else {
        setError(result.error || "Error al enviar")
      }
    } catch {
      setError("Error de conexion")
    } finally {
      setSending(false)
    }
  }, [
    text,
    attachment,
    sending,
    channelType,
    contact.id,
    onMessageSent,
    signature,
    isNote,
    mentionedIds,
  ])

  // -------------------------------------------------------------------------
  // Textarea change handler — manages mention picker + canned-responses "/"
  // -------------------------------------------------------------------------

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart ?? value.length
    setText(value)

    if (isNote) {
      const token = detectMentionToken(value, cursor)
      if (token) {
        mentionStartRef.current = token.start
        setMentionQuery(token.query)
        setMentionOpen(true)
      } else if (mentionOpen) {
        setMentionOpen(false)
      }
      return
    }

    // Message mode: canned responses with "/"
    if (value.startsWith("/") && !pickerOpen) {
      setPickerFilter(value.slice(1))
      setPickerOpen(true)
    } else if (pickerOpen && value.startsWith("/")) {
      setPickerFilter(value.slice(1))
    } else if (pickerOpen && !value.startsWith("/")) {
      setPickerOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Pickers handle their own arrow/enter keys
    if (pickerOpen || mentionOpen) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePickTemplate = (item: CannedResponse) => {
    setText(item.body)
    setPickerOpen(false)
    setTimeout(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(item.body.length, item.body.length)
      }
    }, 0)
  }

  const openMentionMenuManually = () => {
    if (!isNote) return
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const needsSpace = before.length > 0 && !/\s$/.test(before)
    const insertion = (needsSpace ? " @" : "@")
    const newText = before + insertion + text.slice(cursor)
    setText(newText)
    mentionStartRef.current = before.length + (needsSpace ? 1 : 0)
    setMentionQuery("")
    setMentionOpen(true)
    setTimeout(() => {
      const pos = before.length + insertion.length
      el.focus()
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  if (!channel.canSend && !isNote) {
    return (
      <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <ModeTabs mode={mode} onChange={setMode} />
        <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
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
    <div
      className={cn(
        "border-t px-4 py-3 flex-shrink-0 relative transition-colors",
        isNote ? "border-amber-200 bg-amber-50/40" : "border-gray-200"
      )}
    >
      <ModeTabs mode={mode} onChange={setMode} />

      {/* Canned responses popover */}
      {!isNote && (
        <CannedResponsesPicker
          open={pickerOpen}
          initialFilter={pickerFilter}
          onClose={() => setPickerOpen(false)}
          onPick={handlePickTemplate}
        />
      )}

      {/* Product picker popover */}
      {!isNote && (
        <ProductPickerPopover
          open={productPickerOpen}
          onClose={() => setProductPickerOpen(false)}
          onPick={handlePickProduct}
        />
      )}

      {/* Emoji picker popover */}
      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onPick={(e) => insertEmoji(e)}
      />

      {/* Mention picker popover (note mode only) */}
      {isNote && (
        <MentionPicker
          open={mentionOpen}
          query={mentionQuery}
          members={teamMembers}
          onClose={() => setMentionOpen(false)}
          onPick={handlePickMention}
        />
      )}

      {/* Error display */}
      {error && (
        <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* Attachment preview (message mode only) */}
      {!isNote && (attachment || uploading) && (
        <div className="mb-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 max-w-xs">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Subiendo archivo...</span>
            </>
          ) : attachment ? (
            <>
              {attachment.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <span className="text-xs text-gray-700 truncate flex-1">
                {attachment.filename}
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="flex-shrink-0 text-gray-400 hover:text-red-500"
                title="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,application/pdf"
        onChange={handleFileChange}
      />

      <div className="flex items-end gap-2">
        {/* Channel / mode indicator */}
        <div className="flex-shrink-0 pb-1.5">
          {isNote ? (
            <StickyNote className="w-5 h-5 text-amber-500" />
          ) : (
            <ChannelIcon className={cn("w-5 h-5", channel.color)} />
          )}
        </div>

        {/* Action buttons */}
        {isNote ? (
          <button
            type="button"
            onClick={openMentionMenuManually}
            title="Mencionar a alguien del equipo"
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors border bg-white border-amber-200 text-amber-700 hover:bg-amber-100"
          >
            <AtSign className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              title="Adjuntar archivo o foto"
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
                "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-veloce-600",
                (uploading || sending) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setProductPickerOpen((v) => !v)}
              title="Enviar producto del catálogo"
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
                productPickerOpen
                  ? "bg-veloce-50 border-veloce-300 text-veloce-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-veloce-600"
              )}
            >
              <Package className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          title="Emojis"
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
            emojiOpen
              ? "bg-veloce-50 border-veloce-300 text-veloce-700"
              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-veloce-600"
          )}
        >
          <Smile className="w-4 h-4" />
        </button>

        {!isNote && (
          <button
            type="button"
            onClick={() => {
              setPickerFilter("")
              setPickerOpen((v) => !v)
            }}
            title="Plantillas (o escribe / al inicio)"
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
              pickerOpen
                ? "bg-veloce-50 border-veloce-300 text-veloce-700"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-veloce-600"
            )}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isNote
              ? "Escribe una nota interna... @ para mencionar a alguien"
              : "Escribe un mensaje... (o '/' para usar plantillas)"
          }
          rows={1}
          className={cn(
            "flex-1 min-h-[36px] max-h-[120px] rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 resize-none",
            isNote
              ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-500"
              : "border-gray-300 text-gray-900 focus:border-veloce-500 focus:ring-veloce-500"
          )}
          disabled={sending}
        />

        {/* Send / Save button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && (isNote || !attachment)) || sending || uploading}
          className={cn(
            "flex-shrink-0 h-9 rounded-lg flex items-center justify-center transition-colors px-3 gap-1.5 text-sm font-medium",
            isNote
              ? text.trim() && !sending
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-amber-100 text-amber-300 cursor-not-allowed"
              : (text.trim() || attachment) && !sending && !uploading
                ? "bg-veloce-500 text-white hover:bg-veloce-600"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
          title={isNote ? "Guardar nota (Enter)" : "Enviar (Enter)"}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isNote ? (
            <>
              <StickyNote className="w-4 h-4" />
              <span>Guardar</span>
            </>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        {isNote
          ? "Las notas solo las ve el equipo — el cliente NO las recibe. Usa @ para mencionar."
          : "Enter para enviar, Shift+Enter para nueva linea, / para plantillas"}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs above the composer
// ---------------------------------------------------------------------------

function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  return (
    <div className="flex gap-1 mb-2 -mt-1">
      <button
        type="button"
        onClick={() => onChange("message")}
        className={cn(
          "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border",
          mode === "message"
            ? "bg-white text-gray-900 border-gray-300 shadow-sm"
            : "text-gray-500 border-transparent hover:text-gray-700"
        )}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Mensaje
      </button>
      <button
        type="button"
        onClick={() => onChange("note")}
        className={cn(
          "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border",
          mode === "note"
            ? "bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
            : "text-gray-500 border-transparent hover:text-gray-700"
        )}
      >
        <StickyNote className="w-3.5 h-3.5" />
        Nota interna
      </button>
    </div>
  )
}

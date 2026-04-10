"use client"

import React, { useState, useTransition } from "react"
import { Pin, PinOff, Send } from "lucide-react"
import { Button, Textarea, Avatar } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatRelativeTime, cn } from "@/lib/utils"
import { createNote, togglePinNote } from "@/app/actions/contacts"
import type { Note } from "@/lib/types"

interface ContactNotesProps {
  contactId: string
  initialNotes: Note[]
}

export function ContactNotes({
  contactId,
  initialNotes,
}: ContactNotesProps) {
  const { locale } = useI18n()
  const { toast } = useToast()
  const [notes, setNotes] = useState(initialNotes)
  const [newNote, setNewNote] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return

    startTransition(async () => {
      const result = await createNote(contactId, newNote)
      if (result.success) {
        toast("success", "Nota agregada")
        setNewNote("")
        // Optimistic: add to front
        setNotes((prev) => [
          {
            id: crypto.randomUUID(),
            contact_id: contactId,
            lead_id: null,
            deal_id: null,
            body: newNote.trim(),
            is_pinned: false,
            created_by: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ])
      } else {
        toast("error", result.error ?? "Error al agregar nota")
      }
    })
  }

  function handleTogglePin(noteId: string, currentlyPinned: boolean) {
    startTransition(async () => {
      const result = await togglePinNote(noteId, !currentlyPinned)
      if (result.success) {
        setNotes((prev) =>
          prev
            .map((n) =>
              n.id === noteId ? { ...n, is_pinned: !currentlyPinned } : n
            )
            .sort((a, b) => {
              if (a.is_pinned && !b.is_pinned) return -1
              if (!a.is_pinned && b.is_pinned) return 1
              return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
              )
            })
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form onSubmit={handleAddNote} className="flex gap-2">
        <div className="flex-1">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Agregar una nota..."
            rows={2}
            className="min-h-[60px]"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          loading={isPending}
          disabled={!newNote.trim()}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          No hay notas aun
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                note.is_pinned
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {note.creator && (
                    <Avatar
                      src={note.creator.avatar_url}
                      firstName={note.creator.full_name?.split(" ")[0]}
                      lastName={note.creator.full_name?.split(" ")[1]}
                      size="sm"
                    />
                  )}
                  <div>
                    {note.creator && (
                      <span className="text-xs font-medium text-gray-700">
                        {note.creator.full_name}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-gray-400">
                      {formatRelativeTime(note.created_at, locale)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePin(note.id, note.is_pinned)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-yellow-600 transition-colors"
                  aria-label={note.is_pinned ? "Desanclar" : "Anclar"}
                >
                  {note.is_pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

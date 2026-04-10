"use client"

import React, { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Pin,
  PinOff,
  Trash2,
  Edit3,
  Plus,
  StickyNote,
  Check,
  X,
} from "lucide-react"
import { Avatar, Button } from "@/components/ui"
import { Textarea } from "@/components/ui/Textarea"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { formatRelativeTime } from "@/lib/utils"
import {
  createNote,
  updateNote,
  deleteNote,
  togglePinNote,
} from "@/app/actions/notes"
import type { Note } from "@/lib/types"

interface NotesListProps {
  notes: Note[]
  contactId?: string
  dealId?: string
  leadId?: string
}

export function NotesList({
  notes,
  contactId,
  dealId,
  leadId,
}: NotesListProps) {
  const { locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showNewNote, setShowNewNote] = useState(false)
  const [newNoteBody, setNewNoteBody] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")

  const handleCreate = useCallback(() => {
    if (!newNoteBody.trim()) return

    startTransition(async () => {
      const result = await createNote({
        body: newNoteBody.trim(),
        contact_id: contactId ?? null,
        deal_id: dealId ?? null,
        lead_id: leadId ?? null,
      })

      if (result.success) {
        setNewNoteBody("")
        setShowNewNote(false)
        toast("success", locale === "es" ? "Nota creada" : "Note created")
        router.refresh()
      } else {
        toast("error", result.error || "Error")
      }
    })
  }, [newNoteBody, contactId, dealId, leadId, locale, router, toast])

  const handleUpdate = useCallback(
    (id: string) => {
      if (!editBody.trim()) return

      startTransition(async () => {
        const result = await updateNote(id, { body: editBody.trim() })
        if (result.success) {
          setEditingId(null)
          setEditBody("")
          toast(
            "success",
            locale === "es" ? "Nota actualizada" : "Note updated"
          )
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [editBody, locale, router, toast]
  )

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await deleteNote(id)
        if (result.success) {
          toast(
            "success",
            locale === "es" ? "Nota eliminada" : "Note deleted"
          )
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [locale, router, toast]
  )

  const handleTogglePin = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await togglePinNote(id)
        if (result.success) {
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [router, toast]
  )

  return (
    <div className="space-y-3">
      {/* Add note button / form */}
      {showNewNote ? (
        <div className="space-y-2">
          <Textarea
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            placeholder={
              locale === "es"
                ? "Escribe una nota..."
                : "Write a note..."
            }
            autoFocus
            className="min-h-[80px]"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowNewNote(false)
                setNewNoteBody("")
              }}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
              {locale === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              loading={isPending}
              disabled={!newNoteBody.trim()}
            >
              <Check className="h-3.5 w-3.5" />
              {locale === "es" ? "Guardar" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowNewNote(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {locale === "es" ? "Agregar nota" : "Add note"}
        </Button>
      )}

      {/* Notes list */}
      {notes.length === 0 && !showNewNote ? (
        <div className="py-6 text-center text-sm text-gray-400">
          <StickyNote className="mx-auto mb-2 h-6 w-6" />
          {locale === "es" ? "Sin notas" : "No notes"}
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border p-3 transition-colors ${
                note.is_pinned
                  ? "border-veloce-200 bg-veloce-50/50"
                  : "border-gray-100 bg-white"
              }`}
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    autoFocus
                    className="min-h-[60px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(note.id)}
                      loading={isPending}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    {note.creator && (
                      <Avatar
                        src={note.creator.avatar_url}
                        firstName={
                          note.creator.full_name?.split(" ")[0] || "?"
                        }
                        lastName={note.creator.full_name?.split(" ")[1] || ""}
                        size="sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {note.creator && (
                          <span className="text-xs font-medium text-gray-700">
                            {note.creator.full_name}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {formatRelativeTime(note.created_at, locale)}
                        </span>
                        {note.is_pinned && (
                          <Pin className="h-3 w-3 text-veloce-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {note.body}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(note.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        disabled={isPending}
                        aria-label={
                          note.is_pinned
                            ? locale === "es"
                              ? "Desfijar"
                              : "Unpin"
                            : locale === "es"
                              ? "Fijar"
                              : "Pin"
                        }
                      >
                        {note.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id)
                          setEditBody(note.body)
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        disabled={isPending}
                        aria-label={locale === "es" ? "Editar" : "Edit"}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        disabled={isPending}
                        aria-label={locale === "es" ? "Eliminar" : "Delete"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

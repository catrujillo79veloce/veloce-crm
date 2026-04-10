"use client"

import React, { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Tag, Plus, Trash2 } from "lucide-react"
import { Button, Input, Card, Badge } from "@/components/ui"
import { useToast } from "@/components/ui/Toast"
import { useI18n } from "@/lib/i18n/config"
import { createTag, deleteTag } from "@/app/actions/tags"
import type { Tag as TagType } from "@/lib/types"

const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
]

interface TagsManagerProps {
  initialTags: TagType[]
}

export default function TagsManager({ initialTags }: TagsManagerProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [tags, setTags] = useState(initialTags)
  const [newTagName, setNewTagName] = useState("")
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0])

  const handleCreate = useCallback(() => {
    if (!newTagName.trim()) {
      toast(
        "error",
        locale === "es" ? "El nombre es requerido" : "Name is required"
      )
      return
    }

    startTransition(async () => {
      const result = await createTag(newTagName.trim(), selectedColor)
      if (result.success && result.tag) {
        setTags((prev) => [...prev, result.tag!])
        setNewTagName("")
        toast(
          "success",
          locale === "es" ? "Etiqueta creada" : "Tag created"
        )
        router.refresh()
      } else {
        toast("error", result.error || "Error")
      }
    })
  }, [newTagName, selectedColor, locale, router, toast])

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await deleteTag(id)
        if (result.success) {
          setTags((prev) => prev.filter((tag) => tag.id !== id))
          toast(
            "success",
            locale === "es" ? "Etiqueta eliminada" : "Tag deleted"
          )
          router.refresh()
        } else {
          toast("error", result.error || "Error")
        }
      })
    },
    [locale, router, toast]
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => router.push("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t.settings.tags}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "es"
              ? "Crea y administra etiquetas"
              : "Create and manage tags"}
          </p>
        </div>
      </div>

      {/* Create new tag form */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {locale === "es" ? "Nueva Etiqueta" : "New Tag"}
        </h2>
        <div className="space-y-3">
          <Input
            placeholder={
              locale === "es"
                ? "Nombre de la etiqueta"
                : "Tag name"
            }
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleCreate()
              }
            }}
          />
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              {locale === "es" ? "Color" : "Color"}
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-7 w-7 rounded-full transition-all ${
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={selectedColor}>{newTagName || "Preview"}</Badge>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={handleCreate}
              loading={isPending}
              disabled={!newTagName.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.common.create}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tags list */}
      <Card>
        <div className="divide-y divide-gray-100">
          {tags.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              <Tag className="mx-auto mb-2 h-8 w-8" />
              {locale === "es"
                ? "No hay etiquetas"
                : "No tags"}
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <Badge color={tag.color}>{tag.name}</Badge>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => handleDelete(tag.id)}
                  disabled={isPending}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                  aria-label={`${locale === "es" ? "Eliminar" : "Delete"} ${tag.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
